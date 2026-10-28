const express = require("express");
const getPool = require('../middleware/sqlconnection');
const bcrypt = require('bcryptjs');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName: rawSortName, sortOrder } = req.query;
        const pool = await getPool();

        const perm = checkPermission(['readAny'], 'users', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        let query = "SELECT * FROM Users";
        const params = [];
        const where = [];

        if (searchValue && searchValue !== "*") {
            where.push("(UserName LIKE ? OR FirstName LIKE ? OR LastName LIKE ? OR Email LIKE ? OR PhoneNumber LIKE ?)");
            const like = `%${searchValue}%`;
            params.push(like, like, like, like, like);
        }
        if (where.length > 0) query += " WHERE " + where.join(" AND ");

        const sortName = rawSortName === "Name" ? "CONCAT(FirstName, ' ', LastName)" : "Id";
        const validOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${sortName} ${validOrder}`;

        const [allRows] = await pool.query(query, params);
        const count = allRows.length;

        let users = allRows;
        if (skip && limit) {
            const [paged] = await pool.query(query + " LIMIT ? OFFSET ?",
                [...params, parseInt(limit), parseInt(skip)]);
            users = paged;
        }

        users.forEach(u => delete u.Password);
        return res.json({ issuccess: true, message: "", count, users });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, users: [] });
    }
});

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Users WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("User not found");

        const perm = checkPermission(['readOwn', 'readAny'], 'users', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const user = rows[0];
        delete user.Password;
        return res.json({ issuccess: true, message: "", count: 1, user });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

router.post("/create", authenticateToken, async (req, res) => {
    let conn;
    try {
        const { UserName, Password, FirstName, LastName, Email, Role, PhoneNumber, IsActive, Schools } = req.body;
        const Picture = req.file ? req.file.filename : '';

        const perm = checkPermission(['createOwn', 'createAny'], 'users', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const pool = await getPool();

        const [existing] = await pool.query("SELECT Id FROM Users WHERE UserName = ?", [UserName]);
        if (existing.length > 0) throw new Error("Username already exists");

        const hashedPassword = await bcrypt.hash(Password, 10);

        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO Users
                (UserName, Password, FirstName, LastName, Email, Role, PhoneNumber, Picture, Token, IsActive, StartDate)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [UserName, hashedPassword, FirstName, LastName, Email,
             Role || 'User', PhoneNumber, Picture, '',
             IsActive !== undefined ? !!IsActive : true, new Date()]
        );

        const userId = result.insertId;

        if (Schools && userId > 0) {
            let schoolIds = [];
            if (Array.isArray(Schools)) schoolIds = Schools;
            else if (typeof Schools === 'string' && Schools.includes(','))
                schoolIds = Schools.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            else if (typeof Schools === 'string')
                schoolIds = [parseInt(Schools)].filter(id => !isNaN(id));

            for (const schoolId of schoolIds) {
                if (isNaN(schoolId)) continue;
                await conn.query(
                    "INSERT INTO UsersSchools (UserId, SchoolId, DateAssigned) VALUES (?, ?, NOW())",
                    [userId, schoolId]
                );
            }
        }

        await conn.commit();
        conn.release();
        conn = null;

        const createdUser = {
            Id: userId, UserName, FirstName, LastName, Email,
            Role: Role || 'User', PhoneNumber, Picture,
            IsActive: IsActive !== undefined ? !!IsActive : true,
            StartDate: new Date()
        };

        return res.json({ issuccess: true, message: "", count: 1, user: createdUser });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch {} conn.release(); }
        console.error('Create user error:', err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

router.post("/update/:id", authenticateToken, async (req, res) => {
    let conn;
    try {
        const pool = await getPool();

        const [rows] = await pool.query("SELECT * FROM Users WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("User not found");

        const user = rows[0];
        const { FirstName, LastName, Email, PhoneNumber, Schools } = req.body;

        const perm = checkPermission(['updateOwn', 'updateAny'], 'users', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const Picture = req.body.Picture != null ? req.body.Picture : user.Picture;
        const token = req.body.Token != null ? req.body.Token : user.Token;
        const isActive = req.body.IsActive != null ? !!req.body.IsActive : user.IsActive;
        const role = req.body.Role != null ? req.body.Role : user.Role;

        user.FirstName = FirstName || user.FirstName;
        user.LastName = LastName || user.LastName;
        user.Email = Email || user.Email;
        user.PhoneNumber = PhoneNumber || user.PhoneNumber;

        conn = await pool.getConnection();
        await conn.beginTransaction();

        await conn.query(
            `UPDATE Users SET
                FirstName = ?, LastName = ?, Email = ?, PhoneNumber = ?,
                IsActive = ?, Role = ?, Picture = ?, Token = ?
             WHERE Id = ?`,
            [user.FirstName, user.LastName, user.Email, user.PhoneNumber,
             isActive, role, Picture, token, user.Id]
        );

        if (req.body.Schools !== undefined) {
            let schoolIds = [];
            if (Array.isArray(Schools)) {
                for (const item of Schools) {
                    if (typeof item === 'string' && item.includes(',')) {
                        schoolIds.push(...item.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)));
                    } else if (typeof item === 'string' && item !== '') {
                        const n = parseInt(item); if (!isNaN(n)) schoolIds.push(n);
                    } else if (typeof item === 'number' && !isNaN(item)) {
                        schoolIds.push(item);
                    }
                }
            } else if (typeof Schools === 'string' && Schools.includes(',')) {
                schoolIds = Schools.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            } else if (typeof Schools === 'string' && Schools !== '') {
                const n = parseInt(Schools); if (!isNaN(n)) schoolIds.push(n);
            } else if (typeof Schools === 'number' && !isNaN(Schools)) {
                schoolIds.push(Schools);
            }

            schoolIds = [...new Set(schoolIds)];

            await conn.query("DELETE FROM UsersSchools WHERE UserId = ?", [user.Id]);

            for (const schoolId of schoolIds) {
                if (isNaN(schoolId)) continue;
                await conn.query(
                    "INSERT INTO UsersSchools (UserId, SchoolId, DateAssigned) VALUES (?, ?, NOW())",
                    [user.Id, schoolId]
                );
            }
        }

        await conn.commit();
        conn.release();
        conn = null;

        const [updated] = await pool.query("SELECT * FROM Users WHERE Id = ?", [req.params.id]);
        const [schools] = await pool.query(`
            SELECT s.Id, s.Name, s.Description, s.RequiresInvite
            FROM Schools s
            JOIN UsersSchools us ON s.Id = us.SchoolId
            WHERE us.UserId = ?
            ORDER BY s.Name
        `, [req.params.id]);

        const finalUser = updated[0];
        delete finalUser.Password;
        finalUser.Schools = schools;

        return res.json({ issuccess: true, message: "", count: 1, user: finalUser });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch {} conn.release(); }
        console.error('Update user error:', err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

router.post("/delete/:id", authenticateToken, async (req, res) => {
    let conn;
    try {
        const pool = await getPool();

        const [rows] = await pool.query("SELECT * FROM Users WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("User not found");

        const perm = checkPermission(['deleteOwn', 'deleteAny'], 'users', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        conn = await pool.getConnection();
        await conn.beginTransaction();

        await conn.query("DELETE FROM UsersSchools WHERE UserId = ?", [req.params.id]);
        await conn.query("DELETE FROM Users WHERE Id = ?", [req.params.id]);

        await conn.commit();
        conn.release();
        conn = null;

        return res.json({ issuccess: true, message: "", count: 0, user: null });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch {} conn.release(); }
        console.error('Delete user error:', err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

router.post('/changepassword/:id', authenticateToken, async (req, res) => {
    try {
        const { PasswordOld, PasswordNew, PasswordConfirm } = req.body;

        if (PasswordNew !== PasswordConfirm) throw new Error("New Password and confirmation don't match!!!");
        if (PasswordOld === PasswordNew) throw new Error("Old Password and New Password are the same!!!");

        const { id } = req.params;
        const pool = await getPool();

        const [rows] = await pool.query('SELECT * FROM Users WHERE Id = ?', [id]);
        if (rows.length === 0) throw new Error("User not found!!!");

        const user = rows[0];

        const perm = checkPermission(['updateOwn', 'updateAny'], 'users', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const isMatch = await bcrypt.compare(PasswordOld, user.Password);
        if (!isMatch) throw new Error("Password mismatch!!!");

        const hashedPassword = await bcrypt.hash(PasswordNew, 10);
        await pool.query("UPDATE Users SET Password = ? WHERE Id = ?", [hashedPassword, id]);

        delete user.Password;
        return res.json({ issuccess: true, message: "Password changed successfully", count: 1, user });
    } catch (err) {
        console.error('Change password error:', err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

router.get('/role/:role', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();

        const perm = checkPermission(['readAny'], 'users', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const [rows] = await pool.query("SELECT * FROM Users WHERE Role = ?", [req.params.role]);
        rows.forEach(u => delete u.Password);

        return res.json({ issuccess: true, message: "", count: rows.length, users: rows });
    } catch (err) {
        console.error(err);
        return res.json({ issuccess: false, message: err.message, count: 0, users: [] });
    }
});

router.get("/:id/schools", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const [users] = await pool.query("SELECT * FROM Users WHERE Id = ?", [id]);
        if (users.length === 0) throw new Error("User not found");

        const [rows] = await pool.query(`
            SELECT s.Id, s.Name, s.Description, s.RequiresInvite
            FROM Schools s
            JOIN UsersSchools us ON s.Id = us.SchoolId
            WHERE us.UserId = ?
            ORDER BY s.Name
        `, [id]);

        return res.json({ issuccess: true, message: "", count: rows.length, schools: rows });
    } catch (err) {
        console.error("Error fetching user schools:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, schools: [] });
    }
});

router.post("/:id/schools", authenticateToken, async (req, res) => {
    let conn;
    try {
        const { id } = req.params;
        const { schoolIds } = req.body;
        const pool = await getPool();

        const [users] = await pool.query("SELECT * FROM Users WHERE Id = ?", [id]);
        if (users.length === 0) throw new Error("User not found");

        const perm = checkPermission(['updateOwn', 'updateAny'], 'users', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        conn = await pool.getConnection();
        await conn.beginTransaction();

        await conn.query("DELETE FROM UsersSchools WHERE UserId = ?", [id]);

        if (schoolIds && schoolIds.length > 0) {
            for (const schoolId of schoolIds) {
                await conn.query(
                    "INSERT INTO UsersSchools (UserId, SchoolId, DateAssigned) VALUES (?, ?, NOW())",
                    [id, schoolId]
                );
            }
        }

        await conn.commit();
        conn.release();
        conn = null;

        const [rows] = await pool.query(`
            SELECT s.Id, s.Name, s.Description, s.RequiresInvite
            FROM Schools s
            JOIN UsersSchools us ON s.Id = us.SchoolId
            WHERE us.UserId = ?
            ORDER BY s.Name
        `, [id]);

        return res.json({ issuccess: true, message: "Schools assigned successfully", count: rows.length, schools: rows });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch {} conn.release(); }
        console.error("Error assigning user schools:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, schools: [] });
    }
});

module.exports = router;