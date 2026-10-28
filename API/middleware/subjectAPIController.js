const express = require("express");
const getPool = require('./sqlconnection');
const { authenticateToken, checkPermission } = require("./_baseAPIController");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName, sortOrder } = req.query;
        const pool = await getPool();

        const perm = checkPermission(['readAny'], 'subjects', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        let query = "SELECT * FROM Subjects";
        const params = [];
        const where = [];

        if (searchValue && searchValue !== "*") {
            where.push("Name LIKE ?");
            params.push(`%${searchValue}%`);
        }
        if (where.length > 0) query += " WHERE " + where.join(" AND ");

        const validSortName = sortName === "Name" ? "Name" : "Id";
        const validOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${validSortName} ${validOrder}`;

        const [allRows] = await pool.query(query, params);
        const count = allRows.length;

        let subjects = allRows;
        if (skip && limit) {
            const [paged] = await pool.query(query + " LIMIT ? OFFSET ?",
                [...params, parseInt(limit), parseInt(skip)]);
            subjects = paged;
        }

        return res.json({ issuccess: true, message: "", count, subjects });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subjects: [] });
    }
});

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Subjects WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Subject not found");

        const perm = checkPermission(['readOwn', 'readAny'], 'subjects', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        return res.json({ issuccess: true, message: "", count: 1, subject: rows[0] });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subject: null });
    }
});

router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { Name } = req.body;

        const perm = checkPermission(['createOwn', 'createAny'], 'subjects', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const pool = await getPool();
        const dateCreated = new Date();

        const [result] = await pool.query(
            "INSERT INTO Subjects (Name, DateCreated) VALUES (?, ?)",
            [Name, dateCreated]
        );

        return res.json({
            issuccess: true, message: "", count: 1,
            subject: { Id: result.insertId, Name, DateCreated: dateCreated }
        });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subject: null });
    }
});

router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Subjects WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Subject not found");

        const perm = checkPermission(['updateOwn', 'updateAny'], 'subjects', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const subject = rows[0];
        const { Name } = req.body;
        subject.Name = Name || subject.Name;

        await pool.query("UPDATE Subjects SET Name = ? WHERE Id = ?", [subject.Name, subject.Id]);

        return res.json({ issuccess: true, message: "", count: 1, subject });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subject: null });
    }
});

router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Subjects WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Subject not found");

        const perm = checkPermission(['deleteOwn', 'deleteAny'], 'subjects', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        await pool.query("DELETE FROM Subjects WHERE Id = ?", [req.params.id]);
        return res.json({ issuccess: true, message: "", count: 0, subject: null });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subject: null });
    }
});

module.exports = router;