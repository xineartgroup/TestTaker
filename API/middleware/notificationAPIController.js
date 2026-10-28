const express = require('express');
const getPool = require('./sqlconnection');
const admin = require('firebase-admin');
const nodemailer = require("nodemailer");
require('dotenv').config();

const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

const sendEmail465 = async (mail) => {
  try {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    const info = await transporter.sendMail(mail);
    return { issuccess: true, message: "Email sent successfully", id: info.messageId };
  } catch (err) {
    return { issuccess: false, message: err.message, id: "" };
  }
};

const sendEmail587 = async (mail) => {
  try {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    const info = await transporter.sendMail(mail);
    return { issuccess: true, message: "Email sent successfully", id: info.messageId };
  } catch (err) {
    return { issuccess: false, message: err.message, id: "" };
  }
};

router.post('/send_mail', async (req, res) => {
  try {
    const mail = req.body;
    let result = await sendEmail465(mail);
    if (!result.issuccess) result = await sendEmail587(mail);
    return res.json(result);
  } catch (err) {
    console.error("Error sending email:", err);
    return res.json({ issuccess: false, message: err.message, id: "" });
  }
});

router.post('/send_notification', async (req, res) => {
    try {
        const users = req.body.Recipients.map(recipient => recipient.Id);
        const caption = req.body.Caption;
        const detail = req.body.Detail;
        const pool = await getPool();

        if (users.length > 0) {
            const placeholders = users.map(() => '?').join(',');
            const [logins] = await pool.query(
                `SELECT * FROM Logins WHERE ContributorId IN (${placeholders})`, users
            );

            const id = Math.floor(Math.random() * 1000000);
            const userTokens = logins.map(login => login.Token);

            if (userTokens.length > 0) {
                const message = {
                    notification: { title: caption, body: detail },
                    data: { title: String(caption || ''), body: String(detail || ''), id: String(id) },
                    tokens: userTokens
                };

                const response = await admin.messaging().sendEachForMulticast(message);
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.error(`Error for token ${userTokens[idx]}: `, `${resp.error.message} (${resp.error.code})`);
                    }
                });
                return res.json({
                    issuccess: true,
                    message: `successCount: ${response.successCount}. failureCount: ${response.failureCount}`,
                    count: response.successCount
                });
            }
        }

        return res.json({ issuccess: true, message: "No notification was sent.", count: 0 });
    } catch (err) {
        console.error(err);
        return res.json({ issuccess: false, message: err.message, count: 0 });
    }
});

module.exports = router;