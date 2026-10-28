const express = require('express');
const getPool = require('../middleware/sqlconnection');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');
const { generateToken, authenticateToken, checkPermission } = require('./_baseAPIController');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const router = express.Router();

const algorithm = 'aes-256-cbc';
const secretKey = Buffer.from(process.env.CIPHER_KEY, 'hex');

const generatePassword = async (length) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    for (let i = 0; i < length; i++) password += charset[Math.floor(Math.random() * charset.length)];
    return password;
};

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { iv: iv.toString('hex'), content: encrypted };
}

router.post('/login', async (req, res) => {
    try {
        const { UserName, Password } = req.body;
        const pool = await getPool();
        const [rows] = await pool.query('SELECT * FROM Users WHERE UserName = ?', [UserName]);
        const user = rows.length > 0 ? rows[0] : null;

        if (user) {
            const isMatch = await bcrypt.compare(Password, user.Password);
            if (isMatch) {
                if (user.IsActive) {
                    const token = generateToken(user.Id, user.Role);
                    delete user.Password;
                    return res.json({ issuccess: true, message: "", count: 1, token, user });
                }
                return res.json({ issuccess: false, message: "Account Inactive", token: null, count: 1, user });
            }
        }

        return res.json({ issuccess: false, message: "Invalid username or password", count: 0, token: null, user: null });
    } catch (err) {
        return res.json({ issuccess: false, message: "Login error: " + err.message, count: 0, token: null, user: null });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { UserName, Password, FirstName, LastName, Email, Role, PhoneNumber, Picture, IsActive } = req.body;
        const pool = await getPool();

        const [existing] = await pool.query('SELECT Id FROM Users WHERE UserName = ?', [UserName]);
        if (existing.length > 0) {
            return res.json({ issuccess: false, message: "Username already exists.", count: 0, user: null });
        }

        if (Email) {
            const [existingEmail] = await pool.query('SELECT Id FROM Users WHERE Email = ?', [Email]);
            if (existingEmail.length > 0) {
                return res.json({ issuccess: false, message: "Email already registered.", count: 0, user: null });
            }
        }

        const hashedPassword = await bcrypt.hash(Password, 10);

        const [result] = await pool.query(
            `INSERT INTO Users
                (UserName, Password, FirstName, LastName, Email, Role, PhoneNumber, Picture, Token, IsActive, StartDate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                UserName, hashedPassword, FirstName, LastName, Email,
                Role || 'User', PhoneNumber, Picture || '',
                req.body.Token || '',
                IsActive !== undefined ? !!IsActive : false,
                new Date()
            ]
        );

        const Id = result.insertId;

        const newUser = {
            Id, UserName, FirstName, LastName, Email,
            Role: Role || 'User', PhoneNumber,
            Picture: Picture || '',
            IsActive: IsActive !== undefined ? !!IsActive : false,
            StartDate: new Date()
        };

        return res.json({ issuccess: true, message: "Registration successful", count: 1, token: "", user: newUser });
    } catch (err) {
        return res.json({ issuccess: false, message: "Registration error: " + err.message, count: 0, token: null, user: null });
    }
});

router.get("/user/:username", async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query(
            "SELECT * FROM Users WHERE UserName = ? OR Email = ?",
            [req.params.username, req.params.username]
        );
        if (rows.length === 0) throw new Error("User not found");

        const user = rows[0];
        delete user.Password;
        return res.json({ issuccess: true, message: "", user });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, user: null });
    }
});

router.get("/userid/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Users WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("User not found");

        const user = rows[0];
        delete user.Password;
        return res.json({ issuccess: true, message: "", user });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, user: null });
    }
});

router.post("/activate/:token", async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT Id FROM Users WHERE Token = ?", [req.params.token]);
        if (rows.length === 0) {
            return res.json({ issuccess: false, message: "Invalid or expired token", count: 0 });
        }
        const [result] = await pool.query("UPDATE Users SET IsActive = 1, Token = '' WHERE Token = ?", [req.params.token]);
        return res.json({ issuccess: true, message: "Account activated successfully", count: result.affectedRows > 0 });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0 });
    }
});

router.post('/resetpassword', async (req, res) => {
    try {
        const pool = await getPool();
        const user = req.body;
        if (!user || !user.Id) throw new Error("User ID is required");

        const [rows] = await pool.query("SELECT * FROM Users WHERE Id = ?", [user.Id]);
        if (rows.length === 0) throw new Error("User not found!!!");

        const newPassword = await generatePassword(12);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query("UPDATE Users SET Password = ? WHERE Id = ?", [hashedPassword, user.Id]);

        const encryptedData = encrypt(newPassword);
        user.Password = encryptedData.content;
        user.Token = encryptedData.iv;

        return res.json({ issuccess: true, message: "Password reset successfully", count: 1, user });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

router.post('/requestreset', async (req, res) => {
    try {
        const { Email } = req.body;
        if (!Email) return res.json({ issuccess: false, message: "Email is required", count: 0 });

        const pool = await getPool();
        const [rows] = await pool.query("SELECT Id, UserName FROM Users WHERE Email = ?", [Email]);
        if (rows.length === 0) {
            return res.json({ issuccess: false, message: "No user found with this email", count: 0 });
        }

        const user = rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');

        await pool.query(
            "UPDATE Users SET ResetToken = ?, ResetTokenExpiry = ? WHERE Id = ?",
            [resetToken, new Date(Date.now() + 3600000), user.Id]
        );

        return res.json({ issuccess: true, message: "Password reset email sent", count: 1, resetToken });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0 });
    }
});

router.post('/resetwithtoken', async (req, res) => {
    try {
        const { ResetToken, NewPassword } = req.body;
        if (!ResetToken || !NewPassword) {
            return res.json({ issuccess: false, message: "Reset token and new password are required", count: 0 });
        }

        const pool = await getPool();
        const [rows] = await pool.query(
            "SELECT Id FROM Users WHERE ResetToken = ? AND ResetTokenExpiry > NOW()",
            [ResetToken]
        );
        if (rows.length === 0) {
            return res.json({ issuccess: false, message: "Invalid or expired reset token", count: 0 });
        }

        const hashedPassword = await bcrypt.hash(NewPassword, 10);
        await pool.query(
            "UPDATE Users SET Password = ?, ResetToken = NULL, ResetTokenExpiry = NULL WHERE Id = ?",
            [hashedPassword, rows[0].Id]
        );

        return res.json({ issuccess: true, message: "Password updated successfully", count: 1 });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0 });
    }
});

router.post('/logout', authenticateToken, async (req, res) => {
    try {
        res.clearCookie('token');
        return res.json({ issuccess: true, message: "Logged out successfully" });
    } catch (err) {
        return res.json({ issuccess: false, message: "Logout error: " + err.message });
    }
});

router.post('/changepassword', authenticateToken, async (req, res) => {
    try {
        const { CurrentPassword, NewPassword } = req.body;
        const userId = req.user.Id;

        if (!CurrentPassword || !NewPassword) {
            return res.json({ issuccess: false, message: "Current password and new password are required", count: 0 });
        }

        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Users WHERE Id = ?", [userId]);
        if (rows.length === 0) return res.json({ issuccess: false, message: "User not found", count: 0 });

        const user = rows[0];
        const isMatch = await bcrypt.compare(CurrentPassword, user.Password);
        if (!isMatch) return res.json({ issuccess: false, message: "Current password is incorrect", count: 0 });

        const hashedPassword = await bcrypt.hash(NewPassword, 10);
        await pool.query("UPDATE Users SET Password = ? WHERE Id = ?", [hashedPassword, userId]);

        return res.json({ issuccess: true, message: "Password changed successfully", count: 1 });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0 });
    }
});

module.exports = router;