const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

// Get list of options
router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName, sortOrder, questionId } = req.query;
        const pool = await getPool();
        const request = pool.request();

        const permissionResult = checkPermission(['readAny'], 'options', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }
        
        let query = "SELECT * FROM Options";
        let whereConditions = [];

        if (searchValue && searchValue !== "*") {
            whereConditions.push("Text LIKE '%' + @searchValue + '%'");
            request.input('searchValue', searchValue);
        }

        if (questionId) {
            whereConditions.push("QuestionId = @questionId");
            request.input('questionId', parseInt(questionId));
        }

        if (whereConditions.length > 0) {
            query += " WHERE " + whereConditions.join(" AND ");
        }

        const validSortName = sortName === "Text" ? "Text" : "Id";
        const validatedSortOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${validSortName} ${validatedSortOrder}`;

        let optionsResult = await request.query(query);
        const count = optionsResult.recordset.length;

        if (skip && limit) {
            query += " OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY";
            request.input('skip', parseInt(skip));
            request.input('limit', parseInt(limit));
        }

        optionsResult = await request.query(query);
        const options = optionsResult.recordset;

        return res.json({ issuccess: true, message: "", count, options });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, options: [] });
    }
});

// Get a single option by ID
router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Options WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Option not found");
        }

        const permissionResult = checkPermission(['readOwn', 'readAny'], 'options', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        return res.json({ issuccess: true, message: "", count: 1, option: result.recordset[0] });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, option: null });
    }
});

// Create a new option
router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { QuestionId, Text, IsCorrect } = req.body;
        const permissionResult = checkPermission(['createOwn', 'createAny'], 'options', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        const pool = await getPool();
        const dateCreated = new Date();

        const result = await pool.request()
            .input('QuestionId', QuestionId)
            .input('Text', Text)
            .input('IsCorrect', IsCorrect !== undefined ? IsCorrect : false)
            .input('DateCreated', dateCreated)
            .query("INSERT INTO Options (QuestionId, Text, IsCorrect, DateCreated) OUTPUT INSERTED.Id VALUES (@QuestionId, @Text, @IsCorrect, @DateCreated)");
        
        const Id = result.recordset.length > 0 ? result.recordset[0].Id : 0;
        return res.json({ 
            issuccess: true, 
            message: "", 
            count: 1, 
            option: { Id, QuestionId, Text, IsCorrect: IsCorrect !== undefined ? IsCorrect : false, DateCreated: dateCreated } 
        });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, option: null });
    }
});

// Update an existing option
router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Options WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Option not found");
        }

        const permissionResult = checkPermission(['updateOwn', 'updateAny'], 'options', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        let option = result.recordset[0];
        const { QuestionId, Text, IsCorrect } = req.body;

        option.QuestionId = QuestionId !== undefined ? QuestionId : option.QuestionId;
        option.Text = Text || option.Text;
        option.IsCorrect = IsCorrect !== undefined ? IsCorrect : option.IsCorrect;

        await pool.request()
            .input('QuestionId', option.QuestionId)
            .input('Text', option.Text)
            .input('IsCorrect', option.IsCorrect)
            .input('id', option.Id)
            .query("UPDATE Options SET QuestionId = @QuestionId, Text = @Text, IsCorrect = @IsCorrect WHERE Id = @id");

        return res.json({ issuccess: true, message: "", count: 1, option });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, option: null });
    }
});

// Delete an option
router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Options WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Option not found");
        }

        const permissionResult = checkPermission(['deleteOwn', 'deleteAny'], 'options', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        await pool.request()
            .input("id", req.params.id)
            .query("DELETE FROM Options WHERE Id = @id");
        
        return res.json({ issuccess: true, message: "", count: 0, option: null });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, option: null });
    }
});

module.exports = router;