const { makeApiRequest } = require('./_baseController');
const express = require("express");
const upload = require('./upload');
const http = require('http');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // Load environment variables from .env file
const router = express.Router();

const algorithm = 'aes-256-cbc';
const keyHex = process.env.CIPHER_KEY; 
const secretKey = Buffer.from(keyHex, 'hex');

function decrypt(content, iv) {
    const decipher = crypto.createDecipheriv(
        algorithm, 
        secretKey, 
        Buffer.from(iv, 'hex')
    );

    let decrypted = decipher.update(content, 'hex', 'utf8');

    decrypted += decipher.final('utf8');

    return decrypted;
}

const getUser = async (username) => {
    const userResponse = await makeApiRequest('GET', `/api/auth/user/${username}`, null, null);
    if (userResponse.issuccess) {
        return userResponse.user;
    }
    return null;
}

const sendEmailNotification = async (mail, req) => {
    return await makeApiRequest('POST', `/api/notifications/send_mail`, req, mail);
}

const showLoginPage = (req, res) => {
    const message = req.query.msg ? decodeURIComponent(req.query.msg) : '';
    res.render("login", { error: null, message });
};

const login = async (req, res) => {
    try {
        const result = await makeApiRequest('POST', '/api/auth/login', req, req.body);

        if (result.issuccess) {
            req.session.isLoggedIn = true;
            req.session.user = result.user;
            req.session.token = result.token;
    
            res.cookie('token', result.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 3600000
            });

            res.header('X-Cookie-Set', 'true');

            res.redirect("/");
        } else {
            return res.render("login", { error: result.message });
        }
    } catch (error) {
        return res.render("login", { error: "Login error: " + error.message });
    }
};

const showRegisterPage = async (req, res) => {
    try {
        // Removed communities - no longer needed
        return res.render("register", { error: null, config });
    } catch (error) {
        return res.render("register", { error: "Error loading registration page:" + error.message, config });
    }
};

const register = async (req, res) => {
    try {
        let user = req.body;
        user.Picture = req.file ? req.file.filename : '';
        // Generate activation token
        user.Token = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        const result = await makeApiRequest('POST', '/api/auth/register', req, user);

        if (result.issuccess) {

            const url = `${process.env.WEB_APP_URL}/activate?token=${user.Token}`;

            const mail = {
                from: `"Xineart Solutions" ${process.env.SMTP_USER}`,
                to: user.Email,
                subject: "User Registration",
                text: "User Registration",
                html: `<h1>User Registration</h1>
                <p>
                    Hello ${user.FirstName},
                </p>
                <p>
                    An account has been created with this email on <b>TestTaker</b>.
                    <ul>
                        <li>Username: <b>${user.UserName}</b></li>
                        <li>Role: <b>${user.Role || 'User'}</b></li>
                    </ul>
                </p>
                <p>
                    For security reasons, the account needs to be <a href="${url}">activated</a>.<br>
                    If you are not the one who initiated this, please ignore this mail.<br>
                </p>
                <p>
                    Thank you,<br>
                    Xineart Solutions.
                <p>`,
            };
            const resultEmail = await sendEmailNotification(mail, req);
            const message = resultEmail.issuccess ? `Email was sent to ${result.user.Email} for activation.` : `Email was NOT sent. ${resultEmail.message}` ;
            return res.redirect(`/login?msg=${encodeURIComponent(message)}`);
        } else {
            return res.render("register", { error: "Registration Failed!!! " + result.message, config });
        }
    } catch (error) {
        return res.render("register", { error: "Registration error: " + error.message, config });
    }
};

const showResetPasswordPage = async (req, res) => {
    try {
        return res.render("resetpassword", { error: null, config });
    } catch (error) {
        return res.render("resetpassword", { error: "Error:" + error.message, config });
    }
};

const resetPassword = async (req, res) => {
    try {
        let username = req.body.UserName;
        let user = await getUser(username);
        
        if (user) {
            const result = await makeApiRequest('POST', `/api/auth/resetpassword`, req, user);
            
            if (result.issuccess) {
                user = result.user; // password must have changed (and encrypted) at this point
                user.Password = decrypt(user.Password, user.Token);
                
                const mail = {
                    from: `"Xineart Solutions" ${process.env.SMTP_USER}`,
                    to: user.Email,
                    subject: "Password Reset",
                    text: "Password Reset",
                    html: `<h1>Password Reset</h1>
                    <p>
                        Hello ${user.FirstName},
                    </p>
                    <p>
                        Your Password on <b>TestTaker</b> has been reset:
                        <ul>
                            <li>Your Username is <b>${user.UserName}</b></li>
                            <li>Your new password is <b>${user.Password}</b></li>
                        </ul>
                    </p>
                    <p>
                        Use this password on next login. You are advised to login and change it immediately.<br>
                        If you are not the one who initiated this, send a reply to this email - <b>${process.env.SMTP_USER}</b>.<br>
                        If the password doesn't work, initiate another password reset using the Forgot Password link.<br>
                        If the account <b>${user.UserName}</b> does not belong to you, please ignore this mail.<br>
                    </p>
                    <p>
                        Thank you,<br>
                        Xineart Solutions.
                    <p>`,
                };
                
                const resultEmail = await sendEmailNotification(mail, req);
                const message = resultEmail.issuccess ? 
                    `Password has been reset for ${user.UserName} (${user.Email})` : 
                    `Email was NOT sent. ${resultEmail.message}`;
                    
                return res.redirect(`/login?msg=${encodeURIComponent(message)}`);
            } else {
                return res.render("resetpassword", { error: "Couldn't change password. " + result.message, config });
            }
        }
        return res.render("resetpassword", { error: "Couldn't find user", config });
    } catch (error) {
        return res.render("resetpassword", { error: "Error:" + error.message, config });
    }
};

const activate = async (req, res) => {
    try {
        const result = await makeApiRequest('POST', `/api/auth/activate/${req.query.token}`, null, null);
        
        if (result.issuccess) {
            const message = `Account has been activated.`;
            return res.render(`activate`, { message, config });
        } else {
            return res.render("activate", { error: "Couldn't activate account. " + result.message, config });
        }
    } catch (error) {
        return res.render("activate", { error: "Error:" + error.message, config });
    }
};

const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        } else {
            res.clearCookie('token');
            res.redirect('/login');
        }
    });
};

// Routes
router.get("/login", showLoginPage);
router.post("/login", login);
router.get("/register", showRegisterPage);
router.post("/register", upload.single("Picture"), register);
router.get("/resetpassword", showResetPasswordPage);
router.post("/resetpassword", resetPassword);
router.get("/activate", activate);
router.get("/logout", logout);

module.exports = router;