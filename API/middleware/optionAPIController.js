const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName, sortOrder, questionId } = req.query;
        const pool = await getPool();

        const perm = checkPermission(['readAny'], 'options', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        let query = "SELECT * FROM Options";
        const params = [];
        const where = [];

        if (searchValue && searchValue !== "*") {
            where.push("Text LIKE ?");
            params.push(`%${searchValue}%`);
        }
        if (questionId) {
            where.push("QuestionId = ?");
            params.push(parseInt(questionId));
        }
        if (where.length > 0) query += " WHERE " + where.join(" AND ");

        const validSortName = sortName === "Text" ? "Text" : "Id";
        const validOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${validSortName} ${validOrder}`;

        const [allRows] = await pool.query(query, params);
        const count = allRows.length;

        let options = allRows;
        if (skip && limit) {
            const [paged] = await pool.query(query + " LIMIT ? OFFSET ?",
                [...params, parseInt(limit), parseInt(skip)]);
            options = paged;
        }

        return res.json({ issuccess: true, message: "", count, options });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, options: [] });
    }
});

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Options WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Option not found");

        const perm = checkPermission(['readOwn', 'readAny'], 'options', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        return res.json({ issuccess: true, message: "", count: 1, option: rows[0] });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, option: null });
    }
});

router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { QuestionId, Text, IsCorrect } = req.body;

        const perm = checkPermission(['createOwn', 'createAny'], 'options', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const pool = await getPool();
        const dateCreated = new Date();
        const correct = IsCorrect !== undefined ? !!IsCorrect : false;

        const [result] = await pool.query(
            "INSERT INTO Options (QuestionId, Text, IsCorrect, DateCreated) VALUES (?, ?, ?, ?)",
            [QuestionId, Text, correct, dateCreated]
        );

        return res.json({
            issuccess: true, message: "", count: 1,
            option: { Id: result.insertId, QuestionId, Text, IsCorrect: correct, DateCreated: dateCreated }
        });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, option: null });
    }
});

router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Options WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Option not found");

        const perm = checkPermission(['updateOwn', 'updateAny'], 'options', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const option = rows[0];
        const { QuestionId, Text, IsCorrect } = req.body;

        option.QuestionId = QuestionId !== undefined ? QuestionId : option.QuestionId;
        option.Text = Text || option.Text;
        option.IsCorrect = IsCorrect !== undefined ? !!IsCorrect : option.IsCorrect;

        await pool.query(
            "UPDATE Options SET QuestionId = ?, Text = ?, IsCorrect = ? WHERE Id = ?",
            [option.QuestionId, option.Text, option.IsCorrect, option.Id]
        );

        return res.json({ issuccess: true, message: "", count: 1, option });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, option: null });
    }
});

router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Options WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Option not found");

        const perm = checkPermission(['deleteOwn', 'deleteAny'], 'options', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        await pool.query("DELETE FROM Options WHERE Id = ?", [req.params.id]);
        return res.json({ issuccess: true, message: "", count: 0, option: null });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, option: null });
    }
});

module.exports = router;