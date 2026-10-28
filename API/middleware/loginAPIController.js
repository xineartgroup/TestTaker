const express = require("express");
const getPool = require('./sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Logins WHERE Id = ?", [id]);

        if (rows.length === 0) {
            return res.json({ issuccess: false, message: "Login not found", count: 0, login: null });
        }

        return res.json({ issuccess: true, message: "", count: 1, login: rows[0] });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, login: null });
    }
});

router.get("/getbydevice/:device", authenticateToken, async (req, res) => {
    try {
        const { device } = req.params;
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Logins WHERE Device = ?", [device]);

        if (rows.length === 0) {
            return res.json({ issuccess: false, message: "Login not found", count: 0, login: null });
        }

        return res.json({ issuccess: true, message: "", count: 1, login: rows[0] });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, login: null });
    }
});

router.get("/searchbyuser/:userId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Logins WHERE UserId = ?", [userId]);
        res.json({ issuccess: true, message: "", count: rows.length, logins: rows });
    } catch (err) {
        res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, logins: [] });
    }
});

router.get("/searchbyusername/:username", authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        const pool = await getPool();

        const [userRows] = await pool.query("SELECT Id FROM Users WHERE UserName = ?", [username]);
        if (userRows.length === 0) {
            return res.json({ issuccess: false, message: "User not found", count: 0, logins: [] });
        }

        const userId = userRows[0].Id;
        const [rows] = await pool.query("SELECT * FROM Logins WHERE UserId = ?", [userId]);
        res.json({ issuccess: true, message: "", count: rows.length, logins: rows });
    } catch (err) {
        res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, logins: [] });
    }
});

router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { UserId, Device, Token, IsActive } = req.body;
        const pool = await getPool();

        const [userRows] = await pool.query("SELECT Id FROM Users WHERE Id = ?", [UserId]);
        if (userRows.length === 0) {
            return res.json({ issuccess: false, message: "User not found", count: 0, login: null });
        }

        const [existing] = await pool.query("SELECT Id FROM Logins WHERE UserId = ? AND Device = ?", [UserId, Device]);
        if (existing.length > 0) {
            return res.json({ issuccess: false, message: "Login already exists for this user and device", count: 0, login: null });
        }

        const [result] = await pool.query(
            "INSERT INTO Logins (UserId, Device, Token, IsActive, StartDate) VALUES (?, ?, ?, ?, ?)",
            [UserId, Device, Token, IsActive !== undefined ? !!IsActive : true, new Date()]
        );

        res.json({
            issuccess: true, message: "", count: 1,
            login: { Id: result.insertId, UserId, Device, Token, IsActive: IsActive !== undefined ? !!IsActive : true }
        });
    } catch (err) {
        res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, login: null });
    }
});

router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const pool = await getPool();

        const [rows] = await pool.query("SELECT * FROM Logins WHERE Id = ?", [id]);
        if (rows.length === 0) {
            return res.json({ issuccess: false, message: "No login found with ID", count: 0, login: null });
        }

        const login = rows[0];
        const { UserId, Device, Token, IsActive } = req.body;

        if (UserId && UserId !== login.UserId) {
            const [u] = await pool.query("SELECT Id FROM Users WHERE Id = ?", [UserId]);
            if (u.length === 0) {
                return res.json({ issuccess: false, message: "User not found", count: 0, login: null });
            }
        }

        login.UserId = UserId !== undefined ? UserId : login.UserId;
        login.Device = Device !== undefined ? Device : login.Device;
        login.Token = Token !== undefined ? Token : login.Token;
        login.IsActive = IsActive !== undefined ? !!IsActive : login.IsActive;

        await pool.query(
            "UPDATE Logins SET UserId = ?, Device = ?, Token = ?, IsActive = ? WHERE Id = ?",
            [login.UserId, login.Device, login.Token, login.IsActive, login.Id]
        );

        res.json({ issuccess: true, message: "", count: 1, login });
    } catch (err) {
        res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, login: null });
    }
});

router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const [rows] = await pool.query("SELECT * FROM Logins WHERE Id = ?", [id]);
        if (rows.length === 0) {
            return res.json({ issuccess: false, message: "Login not found", count: 0, login: null });
        }

        await pool.query("DELETE FROM Logins WHERE Id = ?", [id]);
        return res.json({ issuccess: true, message: "Login deleted successfully", count: 0, login: null });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, login: null });
    }
});

router.post("/deactivateall/:userId", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const pool = await getPool();

        const [result] = await pool.query("UPDATE Logins SET IsActive = 0 WHERE UserId = ?", [userId]);
        return res.json({
            issuccess: true,
            message: "All logins deactivated for user",
            count: result.affectedRows || 0,
            logins: null
        });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, logins: null });
    }
});

module.exports = router;