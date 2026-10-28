const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

// Get list of questions
router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName, sortOrder, examId } = req.query;
        const pool = await getPool();
        const request = pool.request();

        const permissionResult = checkPermission(['readAny'], 'questions', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }
        
        let query = "SELECT * FROM Questions";
        let whereConditions = [];

        if (searchValue && searchValue !== "*") {
            whereConditions.push("Text LIKE '%' + @searchValue + '%'");
            request.input('searchValue', searchValue);
        }

        if (examId) {
            whereConditions.push("ExamId = @examId");
            request.input('examId', parseInt(examId));
        }

        if (whereConditions.length > 0) {
            query += " WHERE " + whereConditions.join(" AND ");
        }

        const validSortName = sortName === "Text" ? "Text" : "Id";
        const validatedSortOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${validSortName} ${validatedSortOrder}`;

        let questionsResult = await request.query(query);
        const count = questionsResult.recordset.length;

        if (skip && limit) {
            query += " OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY";
            request.input('skip', parseInt(skip));
            request.input('limit', parseInt(limit));
        }

        questionsResult = await request.query(query);
        const questions = questionsResult.recordset;

        return res.json({ issuccess: true, message: "", count, questions });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, questions: [] });
    }
});

// Get a single question by ID
router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Questions WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Question not found");
        }

        const permissionResult = checkPermission(['readOwn', 'readAny'], 'questions', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        return res.json({ issuccess: true, message: "", count: 1, question: result.recordset[0] });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, question: null });
    }
});

// Create a new question
router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { ExamId, Text, AnswerType } = req.body;
        const permissionResult = checkPermission(['createOwn', 'createAny'], 'questions', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        const pool = await getPool();
        const dateCreated = new Date();

        const result = await pool.request()
            .input('ExamId', ExamId)
            .input('Text', Text)
            .input('AnswerType', AnswerType)
            .input('DateCreated', dateCreated)
            .query("INSERT INTO Questions (ExamId, Text, AnswerType, DateCreated) OUTPUT INSERTED.Id VALUES (@ExamId, @Text, @AnswerType, @DateCreated)");
        
        const Id = result.recordset.length > 0 ? result.recordset[0].Id : 0;
        return res.json({ 
            issuccess: true, 
            message: "", 
            count: 1, 
            question: { Id, ExamId, Text, AnswerType, DateCreated: dateCreated } 
        });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, question: null });
    }
});

// Update an existing question
router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Questions WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Question not found");
        }

        const permissionResult = checkPermission(['updateOwn', 'updateAny'], 'questions', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        let question = result.recordset[0];
        const { ExamId, Text, AnswerType } = req.body;

        question.ExamId = ExamId !== undefined ? ExamId : question.ExamId;
        question.Text = Text || question.Text;
        question.AnswerType = AnswerType !== undefined ? AnswerType : question.AnswerType;

        await pool.request()
            .input('ExamId', question.ExamId)
            .input('Text', question.Text)
            .input('AnswerType', question.AnswerType)
            .input('id', question.Id)
            .query("UPDATE Questions SET ExamId = @ExamId, Text = @Text, AnswerType = @AnswerType WHERE Id = @id");

        return res.json({ issuccess: true, message: "", count: 1, question });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, question: null });
    }
});

// Delete a question
router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Questions WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Question not found");
        }

        const permissionResult = checkPermission(['deleteOwn', 'deleteAny'], 'questions', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        await pool.request()
            .input("id", req.params.id)
            .query("DELETE FROM Questions WHERE Id = @id");
        
        return res.json({ issuccess: true, message: "", count: 0, question: null });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, question: null });
    }
});

module.exports = router;