const express = require("express");
const getPool = require('../middleware/sqlconnection');
const crypto = require('crypto');
const https = require('https');

const router = express.Router();

require('dotenv').config();

const MAX_TRANSACTION_AMOUNT = process.env.MAX_TRANSACTION_AMOUNT;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

router.post('/initialize', async (req, res) => {
  try {
    const { email, amount, orderId, customerData, returnUrl } = req.body;

    if (!email || !amount || !orderId) throw new Error('Email, amount, and orderId are required.');
    if (amount > MAX_TRANSACTION_AMOUNT) throw new Error('Amount is greater than the maximum gateway amount.');

    const amountInKobo = Math.round(amount * 100);
    const reference = `order_${orderId}_${Date.now()}`;
    const BASE_URL = req.protocol + "://" + req.get('host');

    const paymentData = {
      email,
      amount: amountInKobo,
      currency: 'NGN',
      reference,
      callback_url: `${BASE_URL}/api/payment/callback?return_url=${returnUrl || ''}`,
      metadata: {
        order_id: orderId,
        customer_data: customerData || {},
        initiated_at: new Date().toISOString(),
        custom_fields: [
          { display_name: "Order ID", variable_name: "order_id", value: orderId.toString() },
          { display_name: "Customer Email", variable_name: "customer_email", value: email }
        ]
      },
      channels: ['card', 'bank', 'ussd', 'bank_transfer']
    };

    const paystackResponse = await initializePaystackPayment(paymentData);

    if (paystackResponse.issuccess) {
      await storePaymentReference(orderId, reference, paystackResponse.data.access_code, amountInKobo, email);
      res.json({
        issuccess: true,
        data: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          reference,
          amount,
          currency: 'NGN'
        },
        message: 'Payment initialized successfully'
      });
    } else {
      throw new Error('Payment initialization failed.');
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.json({ issuccess: false, message: error.message });
  }
});

function initializePaystackPayment(paymentData) {
  return new Promise((resolve, reject) => {
    const params = JSON.stringify(paymentData);
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = '';
      paystackRes.on('data', (chunk) => { data += chunk; });
      paystackRes.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.status) resolve({ issuccess: true, data: response.data });
          else resolve({ issuccess: false, message: response.message });
        } catch (parseError) {
          reject(new Error('Failed to parse Paystack response'));
        }
      });
    });

    paystackReq.on('error', () => reject(new Error('Network error connecting to Paystack')));
    paystackReq.write(params);
    paystackReq.end();
  });
}

router.get('/callback', async (req, res) => {
  try {
    const { reference, return_url } = req.query;

    if (!reference) return res.redirect(`${return_url}?status=error&message=Missing payment reference`);

    const verificationResult = await verifyPaymentWithPaystack(reference);

    if (verificationResult.issuccess && verificationResult.data.status === 'success') {
      await updatePaymentStatus(verificationResult.data, 'callback');

      const successUrl = return_url
        ? `${return_url}?status=success&reference=${reference}&amount=${verificationResult.data.amount / 100}&api_url=` + req.protocol + "://" + req.get('host')
        : `/payment-success?reference=${reference}`;

      res.redirect(successUrl);
    } else {
      await markPaymentFailed(reference, 'Payment verification failed');

      const failureUrl = return_url
        ? `${return_url}?status=failed&reference=${reference}`
        : `/payment-failed?reference=${reference}`;
      res.redirect(failureUrl);
    }
  } catch (error) {
    console.error('Payment callback error:', error);
    const errorUrl = req.query.return_url
      ? `${req.query.return_url}?status=error&message=Callback processing failed`
      : `/payment-error`;
    res.redirect(errorUrl);
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
                      .update(JSON.stringify(req.body))
                      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) throw new Error('Invalid webhook signature.');

    const event = req.body;

    switch(event.event) {
      case 'charge.success':
        await updatePaymentStatus(event.data, 'webhook');
        break;
      case 'charge.failed':
        await markPaymentFailed(event.data.reference, event.data.gateway_response || 'Payment failed');
        break;
      default:
        break;
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.json({ issuccess: false, message: error.message });
  }
});

router.get('/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) throw new Error('Payment reference is required.');

    const dbPayment = await getPaymentFromDatabase(reference);

    if (dbPayment) {
      res.json({
        issuccess: true,
        paymentrequest: {
          status: dbPayment.status,
          amount: dbPayment.amount / 100,
          currency: 'NGN',
          order_id: dbPayment.order_id,
          email: dbPayment.email,
          paid_at: dbPayment.paid_at,
          created_at: dbPayment.created_at,
          source: 'database'
        }
      });
    } else {
      const verificationResult = await verifyPaymentWithPaystack(reference);
      if (verificationResult.issuccess) {
        const data = verificationResult.data;
        res.json({
          issuccess: true,
          paymentrequest: {
            status: data.status,
            amount: data.amount / 100,
            currency: data.currency,
            paid_at: data.paid_at,
            source: 'paystack'
          }
        });
      } else {
        throw new Error('Payment not found.');
      }
    }
  } catch (error) {
    console.error('Payment status check error:', error);
    res.json({ issuccess: false, message: error.message });
  }
});

function verifyPaymentWithPaystack(reference) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
    };

    const reqH = https.request(options, (resH) => {
      let data = '';
      resH.on('data', (chunk) => { data += chunk; });
      resH.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ issuccess: response.status, data: response.data, message: response.message });
        } catch (parseError) {
          reject(new Error('Failed to parse verification response'));
        }
      });
    });

    reqH.on('error', () => reject(new Error('Network error during verification')));
    reqH.end();
  });
}

async function storePaymentReference(orderId, reference, accessCode, amount, email) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO payment_transactions
       (order_id, reference, access_code, amount, email, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [orderId, reference, accessCode, amount, email, 'pending', new Date()]
  );
}

async function updatePaymentStatus(paymentData, source = 'unknown') {
  const { reference, status, amount, paid_at, metadata } = paymentData;
  const orderId = metadata?.order_id;

  const pool = await getPool();
  await pool.query(
    `UPDATE payment_transactions
        SET status = ?, amount = ?, paid_at = ?, gateway_response = ?, updated_by = ?
      WHERE reference = ?`,
    [status, amount, paid_at || new Date(), paymentData.gateway_response, source, reference]
  );

  if (status === 'success' && orderId) {
    await triggerPostPaymentActions(orderId, paymentData, source);
  }
}

async function markPaymentFailed(reference, reason) {
  const pool = await getPool();
  await pool.query(
    `UPDATE payment_transactions
        SET status = 'failed', failed_at = ?, failure_reason = ?
      WHERE reference = ?`,
    [new Date(), reason, reference]
  );
}

async function getPaymentFromDatabase(reference) {
  const pool = await getPool();
  const [rows] = await pool.query('SELECT * FROM payment_transactions WHERE reference = ?', [reference]);
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

async function triggerPostPaymentActions(orderId, paymentData, source) {
  try {
    console.log(`Triggering post-payment actions for order ${orderId} (source: ${source})`);
    await sendPaymentConfirmationEmail(paymentData.email, orderId, paymentData.amount / 100);
    await updateInventoryLevels(orderId);
    await createDeliveryOrder(orderId);
    await sendSMSNotification(paymentData.customer?.phone, orderId);
  } catch (error) {
    console.error('Error in post-payment actions:', error);
  }
}

async function sendPaymentConfirmationEmail(email, orderId, amount) {
  console.log(`Sending confirmation email to ${email} for order ${orderId} (₦${amount})`);
}
async function updateInventoryLevels(orderId) {
  console.log(`Updating inventory for order ${orderId}`);
}
async function createDeliveryOrder(orderId) {
  console.log(`Creating delivery order for ${orderId}`);
}
async function sendSMSNotification(phone, orderId) {
  if (phone) console.log(`Sending SMS to ${phone} for order ${orderId}`);
}

router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;