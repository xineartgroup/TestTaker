const express = require("express");
const getPool = require('./sqlconnection');
const bcrypt = require('bcryptjs');

const { generateToken, authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const resultLogin = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Logins WHERE id = @id");

        if (resultLogin.recordset.length === 0) {
            return res.json({ issuccess: false, message: "Login not found", count: 0, login: null });
        }

        const login = resultLogin.recordset[0];

        return res.json({ 
            issuccess: true, 
            message: "", 
            count: 1,
            login
        });
    } catch (err) {
        return res.json({ 
            issuccess: false, 
            message: "Server Error: " + err.message, 
            count: 0,
            login: null
        });
    }
});

router.get("/getbydevice/:device", authenticateToken, async (req, res) => {
    try {
        const { device } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input("device", device)
            .query("SELECT * FROM Logins WHERE Device = @device");

        if (result.recordset.length === 0) {
            return res.json({ issuccess: false, message: "Login not found", count: 0, login: null });
        }

        const login = result.recordset[0];

        return res.json({ 
            issuccess: true, 
            message: "", 
            count: 1,
            login
        });
    } catch (err) {
        return res.json({ 
            issuccess: false, 
            message: "Server Error: " + err.message, 
            count: 0,
            login: null
        });
    }
});

router.get("/searchbyuser/:userId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input("userId", userId)
            .query("SELECT * FROM Logins WHERE UserId = @userId");

        const logins = result.recordset;
        res.json({ issuccess: true, message: "", count: logins.length, logins });
    } catch (err) {
        res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, logins: [] });
    }
});

// Added new endpoint to search by username (since we now use Users table)
router.get("/searchbyusername/:username", authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        const pool = await getPool();
        
        // First get the user ID from the username
        const userResult = await pool.request()
            .input("username", username)
            .query("SELECT Id FROM Users WHERE UserName = @username");
        
        if (userResult.recordset.length === 0) {
            return res.json({ issuccess: false, message: "User not found", count: 0, logins: [] });
        }
        
        const userId = userResult.recordset[0].Id;
        
        const result = await pool.request()
            .input("userId", userId)
            .query("SELECT * FROM Logins WHERE UserId = @userId");
        
        const logins = result.recordset;
        res.json({ issuccess: true, message: "", count: logins.length, logins });
    } catch (err) {
        res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, logins: [] });
    }
});

router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { UserId, Device, Token, IsActive } = req.body;

        // Validate that the user exists
        const pool = await getPool();
        const userResult = await pool.request()
            .input("userId", UserId)
            .query("SELECT Id FROM Users WHERE Id = @userId");
        
        if (userResult.recordset.length === 0) {
            return res.json({ issuccess: false, message: "User not found", count: 0, login: null });
        }

        // Check if a login already exists for this user and device
        const existingLogin = await pool.request()
            .input("userId", UserId)
            .input("device", Device)
            .query("SELECT Id FROM Logins WHERE UserId = @userId AND Device = @device");
        
        if (existingLogin.recordset.length > 0) {
            return res.json({ 
                issuccess: false, 
                message: "Login already exists for this user and device", 
                count: 0, 
                login: null 
            });
        }

        const result = await pool.request()
            .input('UserId', UserId)
            .input('Device', Device)
            .input('Token', Token)
            .input('IsActive', IsActive !== undefined ? IsActive : true)
            .input('StartDate', new Date())
            .query("INSERT INTO Logins (UserId, Device, Token, IsActive, StartDate) OUTPUT INSERTED.ID VALUES (@UserId, @Device, @Token, @IsActive, @StartDate)");
        
        const Id = result.recordset.length > 0 ? result.recordset[0].ID : 0;
        
        res.json({ 
            issuccess: true, 
            message: "", 
            count: 1, 
            login: { Id, UserId, Device, Token, IsActive: IsActive !== undefined ? IsActive : true } 
        });
    } catch (err) {
        res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, login: null });
    }
});

router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        
        const pool = await getPool();

        const resultLogin = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Logins WHERE id = @id");

        if (resultLogin.recordset.length === 0) {
            return res.json({ issuccess: false, message: "No login found with ID", count: 0, login: null });
        }
        
        let login = resultLogin.recordset[0];
        const { UserId, Device, Token, IsActive } = req.body;

        // Validate user exists if UserId is being updated
        if (UserId && UserId !== login.UserId) {
            const userResult = await pool.request()
                .input("userId", UserId)
                .query("SELECT Id FROM Users WHERE Id = @userId");
            
            if (userResult.recordset.length === 0) {
                return res.json({ issuccess: false, message: "User not found", count: 0, login: null });
            }
        }

        login.UserId = UserId !== undefined ? UserId : login.UserId;
        login.Device = Device !== undefined ? Device : login.Device;
        login.Token = Token !== undefined ? Token : login.Token;
        login.IsActive = IsActive !== undefined ? IsActive : login.IsActive;

        await pool.request()
            .input('UserId', login.UserId)
            .input('Device', login.Device)
            .input('Token', login.Token)
            .input('IsActive', login.IsActive)
            .input('id', login.Id)
            .query(`UPDATE Logins SET UserId = @UserId, Device = @Device, Token = @Token, IsActive = @IsActive WHERE ID = @id`);

        res.json({ issuccess: true, message: "", count: 1, login });
    } catch (err) {
        res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, login: null });
    }
});

// Added delete endpoint
router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const resultLogin = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Logins WHERE id = @id");

        if (resultLogin.recordset.length === 0) {
            return res.json({ issuccess: false, message: "Login not found", count: 0, login: null });
        }

        await pool.request()
            .input("id", id)
            .query("DELETE FROM Logins WHERE id = @id");
        
        return res.json({ issuccess: true, message: "Login deleted successfully", count: 0, login: null });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, login: null });
    }
});

// Added endpoint to deactivate all logins for a user
router.post("/deactivateall/:userId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const pool = await getPool();

        const result = await pool.request()
            .input("userId", userId)
            .query("UPDATE Logins SET IsActive = 0 WHERE UserId = @userId");

        return res.json({ 
            issuccess: true, 
            message: "All logins deactivated for user", 
            count: result.rowsAffected[0] || 0,
            logins: null 
        });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, logins: null });
    }
});

module.exports = router;