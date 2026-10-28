const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName, sortOrder, examId } = req.query;
        const pool = await getPool();

        const perm = checkPermission(['readAny'], 'questions', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        let query = "SELECT * FROM Questions";
        const params = [];
        const where = [];

        if (searchValue && searchValue !== "*") {
            where.push("Text LIKE ?");
            params.push(`%${searchValue}%`);
        }
        if (examId) {
            where.push("ExamId = ?");
            params.push(parseInt(examId));
        }
        if (where.length > 0) query += " WHERE " + where.join(" AND ");

        const validSortName = sortName === "Text" ? "Text" : "Id";
        const validOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${validSortName} ${validOrder}`;

        const [allRows] = await pool.query(query, params);
        const count = allRows.length;

        let questions = allRows;
        if (skip && limit) {
            const [paged] = await pool.query(query + " LIMIT ? OFFSET ?",
                [...params, parseInt(limit), parseInt(skip)]);
            questions = paged;
        }

        return res.json({ issuccess: true, message: "", count, questions });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, questions: [] });
    }
});

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Questions WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Question not found");

        const perm = checkPermission(['readOwn', 'readAny'], 'questions', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        return res.json({ issuccess: true, message: "", count: 1, question: rows[0] });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, question: null });
    }
});

router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { ExamId, Text, AnswerType } = req.body;

        const perm = checkPermission(['createOwn', 'createAny'], 'questions', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const pool = await getPool();
        const dateCreated = new Date();

        const [result] = await pool.query(
            "INSERT INTO Questions (ExamId, Text, AnswerType, DateCreated) VALUES (?, ?, ?, ?)",
            [ExamId, Text, AnswerType, dateCreated]
        );

        return res.json({
            issuccess: true, message: "", count: 1,
            question: { Id: result.insertId, ExamId, Text, AnswerType, DateCreated: dateCreated }
        });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, question: null });
    }
});

router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Questions WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Question not found");

        const perm = checkPermission(['updateOwn', 'updateAny'], 'questions', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const question = rows[0];
        const { ExamId, Text, AnswerType } = req.body;

        question.ExamId = ExamId !== undefined ? ExamId : question.ExamId;
        question.Text = Text || question.Text;
        question.AnswerType = AnswerType !== undefined ? AnswerType : question.AnswerType;

        await pool.query(
            "UPDATE Questions SET ExamId = ?, Text = ?, AnswerType = ? WHERE Id = ?",
            [question.ExamId, question.Text, question.AnswerType, question.Id]
        );

        return res.json({ issuccess: true, message: "", count: 1, question });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, question: null });
    }
});

router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Questions WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Question not found");

        const perm = checkPermission(['deleteOwn', 'deleteAny'], 'questions', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        await pool.query("DELETE FROM Questions WHERE Id = ?", [req.params.id]);
        return res.json({ issuccess: true, message: "", count: 0, question: null });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, question: null });
    }
});

module.exports = router;