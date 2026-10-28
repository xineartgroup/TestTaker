const express = require('express');
const sql = require('mssql');
const getPool = require('../middleware/sqlconnection');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');
const { generateToken, authenticateToken, checkPermission } = require('./_baseAPIController');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // Load environment variables from .env file

const router = express.Router();

const algorithm = 'aes-256-cbc';
const keyHex = process.env.CIPHER_KEY; 
const secretKey = Buffer.from(keyHex, 'hex');
const iv = crypto.randomBytes(16);

const generatePassword = async (length) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    
    return password;
};

function encrypt(text) {
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    
    encrypted += cipher.final('hex');

    return {
        iv: iv.toString('hex'), // Convert IV to hex string for storage/transmission
        content: encrypted
    };
}

// Login endpoint - updated to use Users table
router.post('/login', async (req, res) => {
    try {
        const { UserName, Password } = req.body;

        const pool = await getPool();
        const result = await pool.request()
            .input('UserName', sql.NVarChar, UserName)
            .query('SELECT * FROM Users WHERE UserName = @UserName');

        const user = result.recordset.length > 0 ? result.recordset[0] : null;

        if (user) {
            const isMatch = await bcrypt.compare(Password, user.Password);
            if (isMatch) {
                if (user.IsActive) {
                    const token = generateToken(user.Id, user.Role, 0);
                    
                    // Remove password before sending response
                    delete user.Password;
                    
                    return res.json({ issuccess: true, message: "", count: 1, token, user });
                }
                else {
                    return res.json({ issuccess: false, message: "Account Inactive", token: null, count: 1, user });
                }
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

        // Check if username already exists
        const existingUser = await pool.request()
            .input('UserName', sql.NVarChar, UserName)
            .query('SELECT * FROM Users WHERE UserName = @UserName');

        console.log("Registering user:", { UserName, FirstName, LastName, Email, Role, PhoneNumber, Picture, IsActive });

        if (existingUser.recordset.length > 0) {
            return res.json({ issuccess: false, message: "Username already exists.", count: 0, user: null });
        }

        // Check if email already exists
        if (Email) {
            const existingEmail = await pool.request()
                .input('Email', sql.NVarChar, Email)
                .query('SELECT * FROM Users WHERE Email = @Email');

            if (existingEmail.recordset.length > 0) {
                return res.json({ issuccess: false, message: "Email already registered.", count: 0, user: null });
            }
        }

        const hashedPassword = await bcrypt.hash(Password, 10);

        const result = await pool.request()
            .input('UserName', UserName)
            .input('Password', hashedPassword)
            .input('FirstName', FirstName)
            .input('LastName', LastName)
            .input('Email', Email)
            .input('Role', Role || 'User') // Default role if not provided
            .input('PhoneNumber', PhoneNumber)
            .input('Picture', Picture || '')
            .input('Token', req.body.Token || '')
            .input('IsActive', IsActive !== undefined ? IsActive : false) // Default to inactive if not specified
            .input('StartDate', new Date())
            .query(`INSERT INTO Users 
                (UserName, Password, FirstName, LastName, Email, Role, PhoneNumber, Picture, Token, IsActive, StartDate) 
                OUTPUT INSERTED.ID VALUES 
                (@UserName, @Password, @FirstName, @LastName, @Email, @Role, @PhoneNumber, @Picture, @Token, @IsActive, @StartDate)`);

        const Id = result.recordset.length > 0 ? result.recordset[0].ID : 0;

        // Generate token (optional - you might want to auto-login after registration)
        const token = ""; // Generate token if you want auto-login
        
        const newUser = { 
            Id, 
            UserName, 
            FirstName, 
            LastName, 
            Email, 
            Role: Role || 'User', 
            PhoneNumber, 
            Picture: Picture || '', 
            IsActive: IsActive !== undefined ? IsActive : false,
            StartDate: new Date()
        };
        
        return res.json({ issuccess: true, message: "Registration successful", count: 1, token, user: newUser });
    } catch (err) {
        return res.json({ issuccess: false, message: "Registration error: " + err.message, count: 0, token: null, user: null });
    }
});

// Get user by username or email - updated to use Users table
router.get("/user/:username", async (req, res) => {
    try {
        const pool = await getPool();
        const resultUser = await pool.request()
            .input("username", req.params.username)
            .query("SELECT * FROM Users WHERE UserName = @username OR Email = @username");

        if (resultUser.recordset.length === 0) {
            throw new Error("User not found");
        }

        const user = resultUser.recordset[0];
        delete user.Password; // Remove password from response

        return res.json({ issuccess: true, message: "", user });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, user: null });
    }
});

// Get user by ID - added new endpoint for consistency
router.get("/userid/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const resultUser = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Users WHERE Id = @id");

        if (resultUser.recordset.length === 0) {
            throw new Error("User not found");
        }

        const user = resultUser.recordset[0];
        delete user.Password; // Remove password from response

        return res.json({ issuccess: true, message: "", user });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, user: null });
    }
});

// Activate user account - updated to use Users table
router.post("/activate/:token", async (req, res) => {
    try {
        const pool = await getPool();

        // Check if token exists and get user
        const userResult = await pool.request()
            .input("token", req.params.token)
            .query("SELECT Id FROM Users WHERE Token = @token");

        if (userResult.recordset.length === 0) {
            return res.json({ issuccess: false, message: "Invalid or expired token", count: 0 });
        }

        // Activate the user and clear the token
        const result = await pool.request()
            .input('IsActive', true)
            .input("token", req.params.token)
            .query(`UPDATE Users SET IsActive = @IsActive, Token = '' WHERE Token = @token`);

        const count = result.rowsAffected[0] > 0;

        return res.json({ issuccess: true, message: "Account activated successfully", count });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0 });
    }
});

// Reset password - updated to use Users table
router.post('/resetpassword', async (req, res) => {
    try {
        const pool = await getPool();
        
        const user = req.body;
        
        if (!user || !user.Id) {
            throw new Error("User ID is required");
        }
        
        // Check if user exists
        const userResult = await pool.request()
            .input('id', user.Id)
            .query("SELECT * FROM Users WHERE ID = @id");
        
        if (userResult.recordset.length === 0) {
            throw new Error("User not found!!!");
        }
        
        const existingUser = userResult.recordset[0];
        
        // Generate new password
        const newPassword = await generatePassword(12);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await pool.request()
            .input('Password', hashedPassword)
            .input('id', user.Id)
            .query(`UPDATE Users SET Password = @Password WHERE ID = @id`);

        // Encrypt the password for secure transmission
        const encryptedData = encrypt(newPassword);
        user.Password = encryptedData.content;
        user.Token = encryptedData.iv;

        return res.json({ issuccess: true, message: "Password reset successfully", count: 1, user });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

// Request password reset (send reset link) - new endpoint
router.post('/requestreset', async (req, res) => {
    try {
        const { Email } = req.body;
        
        if (!Email) {
            return res.json({ issuccess: false, message: "Email is required", count: 0 });
        }
        
        const pool = await getPool();
        
        // Find user by email
        const userResult = await pool.request()
            .input('Email', sql.NVarChar, Email)
            .query("SELECT Id, UserName FROM Users WHERE Email = @Email");
        
        if (userResult.recordset.length === 0) {
            return res.json({ issuccess: false, message: "No user found with this email", count: 0 });
        }
        
        const user = userResult.recordset[0];
        
        // Generate reset token (you might want to store this in a separate table)
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Store the token in the user record (or in a separate password_resets table)
        await pool.request()
            .input('ResetToken', resetToken)
            .input('ResetTokenExpiry', new Date(Date.now() + 3600000)) // 1 hour expiry
            .input('id', user.Id)
            .query(`UPDATE Users SET ResetToken = @ResetToken, ResetTokenExpiry = @ResetTokenExpiry WHERE ID = @id`);
        
        // In a real application, send email with reset link
        // For now, return the token for testing
        return res.json({ 
            issuccess: true, 
            message: "Password reset email sent", 
            count: 1,
            resetToken: resetToken // In production, this would be sent via email
        });
        
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0 });
    }
});

// Reset password with token - new endpoint
router.post('/resetwithtoken', async (req, res) => {
    try {
        const { ResetToken, NewPassword } = req.body;
        
        if (!ResetToken || !NewPassword) {
            return res.json({ issuccess: false, message: "Reset token and new password are required", count: 0 });
        }
        
        const pool = await getPool();
        
        // Find user with valid reset token
        const userResult = await pool.request()
            .input('ResetToken', ResetToken)
            .query("SELECT Id FROM Users WHERE ResetToken = @ResetToken AND ResetTokenExpiry > GETDATE()");
        
        if (userResult.recordset.length === 0) {
            return res.json({ issuccess: false, message: "Invalid or expired reset token", count: 0 });
        }
        
        const user = userResult.recordset[0];
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(NewPassword, 10);
        
        // Update password and clear reset token
        await pool.request()
            .input('Password', hashedPassword)
            .input('id', user.Id)
            .query(`UPDATE Users SET Password = @Password, ResetToken = NULL, ResetTokenExpiry = NULL WHERE ID = @id`);
        
        return res.json({ issuccess: true, message: "Password updated successfully", count: 1 });
        
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0 });
    }
});

// Logout endpoint - unchanged but might want to invalidate token
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // If you're using token-based auth with a token blacklist, add logic here
        // For JWT, the token is typically invalidated on the client side
        res.clearCookie('token');
        return res.json({ issuccess: true, message: "Logged out successfully" });
    } catch (err) {
        return res.json({ issuccess: false, message: "Logout error: " + err.message });
    }
});

// Change password endpoint (authenticated) - new endpoint
router.post('/changepassword', authenticateToken, async (req, res) => {
    try {
        const { CurrentPassword, NewPassword } = req.body;
        const userId = req.user.id; // Assuming the authenticateToken middleware adds user info
        
        if (!CurrentPassword || !NewPassword) {
            return res.json({ issuccess: false, message: "Current password and new password are required", count: 0 });
        }
        
        const pool = await getPool();
        
        // Get user with password
        const userResult = await pool.request()
            .input('id', userId)
            .query("SELECT * FROM Users WHERE Id = @id");
        
        if (userResult.recordset.length === 0) {
            return res.json({ issuccess: false, message: "User not found", count: 0 });
        }
        
        const user = userResult.recordset[0];
        
        // Verify current password
        const isMatch = await bcrypt.compare(CurrentPassword, user.Password);
        if (!isMatch) {
            return res.json({ issuccess: false, message: "Current password is incorrect", count: 0 });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(NewPassword, 10);
        
        // Update password
        await pool.request()
            .input('Password', hashedPassword)
            .input('id', userId)
            .query(`UPDATE Users SET Password = @Password WHERE ID = @id`);
        
        return res.json({ issuccess: true, message: "Password changed successfully", count: 1 });
        
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0 });
    }
});

module.exports = router;