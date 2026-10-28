const sql = require('mssql');
const express = require("express");
const getPool = require('../middleware/sqlconnection');
const crypto = require('crypto');
const https = require('https');

const router = express.Router();

require('dotenv').config(); // Load environment variables from .env file

const MAX_TRANSACTION_AMOUNT = process.env.MAX_TRANSACTION_AMOUNT;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY; // sk_test_xxx or sk_live_xxx
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY; // pk_test_xxx or pk_live_xxx

// ===== 1. INITIALIZATION ENDPOINT - Android/Frontend Calls This =====
router.post('/initialize', async (req, res) => {
  try {
    console.log("req.body", req.body);
    
    const { 
      email, 
      amount, 
      orderId, 
      customerData,
      returnUrl // Optional: where to redirect after payment 
    } = req.body;
    
    // Input validation
    if (!email || !amount || !orderId) {
      throw new Error('Email, amount, and orderId are required.');
    }

    if (amount > MAX_TRANSACTION_AMOUNT) {
      throw new Error('Amount is greater than the maximum gateway amount.');
    }
    
    // Convert amount to kobo (Paystack uses kobo)
    const amountInKobo = Math.round(amount * 100);
    
    // Generate unique reference for this payment
    const reference = `order_${orderId}_${Date.now()}`;

    const strProtocol = req.protocol;
    const strHostname = req.hostname;
    console.log("URL", strProtocol, strHostname)

    const BASE_URL = req.protocol + "://" + req.get('host');

    console.log("returnUrl", `${BASE_URL}/api/payment/callback?return_url=${returnUrl || ''}`);
    
    const paymentData = {
      email: email,
      amount: amountInKobo,
      currency: 'NGN',
      reference: reference,
      callback_url: `${BASE_URL}/api/payment/callback?return_url=${returnUrl || ''}`,
      metadata: {
        order_id: orderId,
        customer_data: customerData || {},
        initiated_at: new Date().toISOString(),
        custom_fields: [
          {
            display_name: "Order ID",
            variable_name: "order_id", 
            value: orderId.toString()
          },
          {
            display_name: "Customer Email",
            variable_name: "customer_email",
            value: email
          }
        ]
      },
      // Optional: Set payment channels
      channels: ['card', 'bank', 'ussd', 'bank_transfer'] // Allow multiple payment methods
    };

    // Call Paystack to initialize payment
    const paystackResponse = await initializePaystackPayment(paymentData);
    
    if (paystackResponse.issuccess) {
      // Store payment reference in database for tracking
      await storePaymentReference(orderId, reference, paystackResponse.data.access_code, amountInKobo, email);
      
      // Return payment details to frontend
      res.json({
        issuccess: true,
        data: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          reference: reference,
          amount: amount,
          currency: 'NGN'
        },
        message: 'Payment initialized successfully'
      });
    } else {
      throw new Error('Payment initialization failed.');
    }

  } catch (error) {
    console.error('Payment initialization error:', error);
    res.json({ 
      issuccess: false, 
      message: error.message
    });
  }
});

// ===== 2. SECURE REDIRECT FLOW - Paystack Initialization Helper =====
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
      paystackRes.on('data', (chunk) => {
        data += chunk;
      });
      paystackRes.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.status) {
            resolve({
              issuccess: true,
              data: response.data
            });
          } else {
            resolve({
              issuccess: false,
              message: response.message
            });
          }
        } catch (parseError) {
          reject(new Error('Failed to parse Paystack response'));
        }
      });
    });

    paystackReq.on('error', (error) => {
      reject(new Error('Network error connecting to Paystack'));
    });

    paystackReq.write(params);
    paystackReq.end();
  });
}

// ===== 3. CALLBACK HANDLER - User Experience Management =====
router.get('/callback', async (req, res) => {
  try {
    const { reference, return_url } = req.query;
    
    console.log(`Payment callback received for reference: ${reference}`);
    
    if (!reference) {
      return res.redirect(`${return_url}?status=error&message=Missing payment reference`);
    }
    
    // Verify payment with Paystack
    const verificationResult = await verifyPaymentWithPaystack(reference);
    
    if (verificationResult.issuccess && verificationResult.data.status === 'success') {
      console.log(`Payment verified successfully: ${reference}`);
      
      // Update database (if not already updated by webhook)
      await updatePaymentStatus(verificationResult.data, 'callback');
      
      // Redirect user to success page
      const successUrl = return_url ? 
        `${return_url}?status=success&reference=${reference}&amount=${verificationResult.data.amount / 100}&api_url=` + req.protocol + "://" + req.get('host') :
        `/payment-success?reference=${reference}`;

      console.log("Redirect URL", successUrl);
        
      res.redirect(successUrl);
      
    } else {
      console.log(`Payment verification failed: ${reference}`);
      
      // Mark payment as failed
      await markPaymentFailed(reference, 'Payment verification failed');
      
      // Redirect user to failure page
      const failureUrl = return_url ? 
        `${return_url}?status=failed&reference=${reference}` :
        `/payment-failed?reference=${reference}`;
        
      res.redirect(failureUrl);
    }
    
  } catch (error) {
    console.error('Payment callback error:', error);
    const errorUrl = req.query.return_url ? 
      `${req.query.return_url}?status=error&message=Callback processing failed` :
      `/payment-error`;
    res.redirect(errorUrl);
  }
});

// ===== 4. WEBHOOK HANDLER - Reliable Database Updates =====
router.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature for security
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
                      .update(JSON.stringify(req.body))
                      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      throw new Error('Invalid webhook signature.');
    }

    const event = req.body;
    console.log(`Webhook received: ${event.event} for reference: ${event.data.reference}`);
    
    // Handle different webhook events
    switch(event.event) {
      case 'charge.success':
        console.log('Payment successful via webhook:', event.data.reference);
        await updatePaymentStatus(event.data, 'webhook');
        break;
        
      case 'charge.failed':
        console.log('Payment failed via webhook:', event.data.reference);
        await markPaymentFailed(event.data.reference, event.data.gateway_response || 'Payment failed');
        break;
        
      case 'transfer.success':
        console.log('Transfer successful:', event.data.reference);
        // Handle successful transfers if you use Paystack for payouts
        break;
        
      case 'transfer.failed':
        console.log('Transfer failed:', event.data.reference);
        // Handle failed transfers
        break;
        
      default:
        console.log(`Unhandled webhook event: ${event.event}`);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.json({ issuccess: false, message: error.message });
  }
});

// ===== 5. STATUS CHECKING - Android Can Verify Payment Completion =====
router.get('/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    if (!reference) {
      throw new Error('Payment reference is required.');
    }
    
    // Check database first for faster response
    const dbPayment = await getPaymentFromDatabase(reference);
    
    if (dbPayment) {
      res.json({
        issuccess: true,
        paymentrequest: {
            status: dbPayment.status,
            amount: dbPayment.amount / 100, // Convert from kobo
            currency: 'NGN',
            order_id: dbPayment.order_id,
            email: dbPayment.email,
            paid_at: dbPayment.paid_at,
            created_at: dbPayment.created_at,
            source: 'database'
        }
      });
    } else {
      // Fallback to Paystack verification if not in database
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
    res.json({ 
      issuccess: false, 
      message: error.message
    });
  }
});

// ===== HELPER FUNCTIONS =====

// Payment verification with Paystack
function verifyPaymentWithPaystack(reference) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            issuccess: response.status,
            data: response.data,
            message: response.message
          });
        } catch (parseError) {
          reject(new Error('Failed to parse verification response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error('Network error during verification'));
    });

    req.end();
  });
}

// Database operations (implement based on your database choice)
async function storePaymentReference(orderId, reference, accessCode, amount, email) {
  try {
        const pool = await getPool();
        await pool.request()
            .input('orderId', orderId)
            .input('reference', reference)
            .input('accessCode', accessCode)
            .input('amount', amount)
            .input('email', email)
            .input('status', 'pending')
            .input('created_at', new Date())
            .query(`INSERT INTO payment_transactions 
            (order_id, reference, access_code, amount, email, status, created_at) 
            VALUES (@orderId, @reference, @accessCode, @amount, @email, @status, @created_at)`);
    
    console.log(`Payment reference stored: ${reference}`);
  } catch (error) {
    console.error('Error storing payment reference:', error);
    throw error;
  }
}

async function updatePaymentStatus(paymentData, source = 'unknown') {
  try {
    const { reference, status, amount, paid_at, metadata } = paymentData;
    const orderId = metadata?.order_id;
    
    // Update payment transaction
        const pool = await getPool();
        await pool.request()
            .input('status', status)
            .input('amount', amount)
            .input('paid_at', paid_at || new Date())
            .input('gateway_response', paymentData.gateway_response)
            .input('source', source)
            .input('reference', reference)
            .query(`UPDATE payment_transactions 
            SET status = @status, amount = @amount, paid_at = @paid_at, gateway_response = @gateway_response, updated_by = @source 
            WHERE reference = @reference`);
    
    if (status === 'success' && orderId) {
      // Trigger post-payment business logic
      await triggerPostPaymentActions(orderId, paymentData, source);
    }
    
    console.log(`Payment status updated: ${reference} -> ${status} (source: ${source})`);
    
  } catch (error) {
    console.error('Error updating payment status:', error);
    throw error;
  }
}

async function markPaymentFailed(reference, reason) {
  try {
        const pool = await getPool();
        await pool.request()
            .input('failed_at', new Date())
            .input('reason', reason)
            .input('reference', reference)
            .query(`UPDATE payment_transactions 
            SET status = 'failed', failed_at = @failed_at, failure_reason = @reason 
            WHERE reference = @reference`);
    
    console.log(`Payment marked as failed: ${reference} - ${reason}`);
  } catch (error) {
    console.error('Error marking payment as failed:', error);
  }
}

async function getPaymentFromDatabase(reference) {
  try {
        const pool = await getPool();
        const result = await pool.request()
            .input('reference', reference)
            .query('SELECT * FROM payment_transactions WHERE reference = @reference');
    return result.length > 0 ? result[result.length - 1] : null;
  } catch (error) {
    console.error('Error getting payment from database:', error);
    return null;
  }
}

async function triggerPostPaymentActions(orderId, paymentData, source) {
  try {
    console.log(`Triggering post-payment actions for order ${orderId} (source: ${source})`);
    
    // Your custom business logic here:
    // - Send confirmation email to customer
    // - Update inventory/stock levels
    // - Create delivery/shipping order
    // - Send SMS notifications
    // - Update customer loyalty points
    // - Generate invoice/receipt
    // - Notify admin/merchants
    // - Update analytics/reporting data
    // - Trigger third-party integrations
    
    // Example implementations:
    await sendPaymentConfirmationEmail(paymentData.email, orderId, paymentData.amount / 100);
    await updateInventoryLevels(orderId);
    await createDeliveryOrder(orderId);
    await sendSMSNotification(paymentData.customer?.phone, orderId);
    
    console.log(`Post-payment actions completed for order ${orderId}`);
    
  } catch (error) {
    console.error('Error in post-payment actions:', error);
    // Log error but don't throw - payment was successful
  }
}

// Example post-payment action implementations
async function sendPaymentConfirmationEmail(email, orderId, amount) {
  // Implement email sending logic
  console.log(`Sending confirmation email to ${email} for order ${orderId} (₦${amount})`);
}

async function updateInventoryLevels(orderId) {
  // Update product stock levels based on order
  console.log(`Updating inventory for order ${orderId}`);
}

async function createDeliveryOrder(orderId) {
  // Create delivery/shipping order
  console.log(`Creating delivery order for ${orderId}`);
}

async function sendSMSNotification(phone, orderId) {
  if (phone) {
    console.log(`Sending SMS to ${phone} for order ${orderId}`);
  }
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
