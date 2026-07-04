const express = require('express');
const getPool = require('./sqlconnection');
const sql = require('mssql');
const admin = require('firebase-admin');
const nodemailer = require("nodemailer");
require('dotenv').config(); // Load environment variables from .env file

const { generateToken, authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

const sendEmail465 = async (mail, res) => {
  try {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        }
    });
    
    const info = await transporter.sendMail(mail);

    return { issuccess: true, message: "Email sent successfully", id: info.messageId };
  } catch (err) {
    return { issuccess: false, message: err.message, id: "" };
  }
};

const sendEmail587 = async (mail, res) => {
  try {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        }
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
    /*{
        from: '"Xineart Solutions" <xineartsolutions@gmail.com>',
        to: "flamer3d@yahoo.com",
        subject: "Test Email from Node.js",
        text: "Hello from Node.js!",
        html: "<h1>Hello from Node.js!</h1><p>This is a test email.</p>",
    };*/

    console.log("Email:", mail);
    let result = await sendEmail465(mail, res); //try with port 465
    console.log("attempt 1", result);

    if (!result.issuccess) {
        result = await sendEmail587(mail, res); //try with port 587
        console.log("attempt 2", result);
    }

    return res.json(result);
  } catch (err) {
    console.error("Error sending email:", err);
    return res.json({ issuccess: false, message: err.message, id: "" });
  }
});

router.post('/send_notification', async (req, res) => {
    try {
        let users = req.body.Recipients.map(recipient => recipient.Id);
        let caption = req.body.Caption;
        let detail = req.body.Detail;
        const pool = await getPool();
        
        if (users.length > 0){
            const resultLogins = await pool.request()
                .query(`SELECT * FROM Logins WHERE ContributorId IN (${users.join(',')})`);
            
            const id = Math.floor(Math.random() * 1000000);
            const logins = resultLogins.recordset;
            const userTokens = logins.map(login => login.Token);
            
            console.log("caption", caption);
            console.log("detail", detail);
            console.log("userTokens", userTokens);

            if (userTokens.length > 0) {
                const message = {
                    notification: {
                        title: caption,
                        body: detail,
                    },
                    data: {
                        title: String(caption || ''),
                        body: String(detail || ''),
                        id: String(id)
                    },
                    tokens: userTokens, // Array of FCM tokens
                };

                try {
                    const response = await admin.messaging().sendEachForMulticast(message);
                    //console.log("response", response);
                    response.responses.forEach((resp, idx) => {
                        if (!resp.success) {
                            console.error(`Error for token ${userTokens[idx]}: `, `${resp.error.message} (${resp.error.code})`);
                        }
                    });
                    return res.json({ issuccess: true, message: `successCount: ${response.successCount}. failureCount: ${response.failureCount}`, count: response.successCount });
                } catch (error) {
                    throw new Error('Error sending message: ' + error);
                }
            }
        }

        return res.json({ issuccess: true, message: "No notification was sent.", count: 0 });
    } catch (err) {
        console.error(err);
        return res.json({ issuccess: false, message: err.message, count: 0 });
    }
});

module.exports = router;
