const express = require("express");
const getPool = require('./sqlconnection');
const { authenticateToken, checkPermission } = require("./_baseAPIController");

const router = express.Router();

// Get list of subjects
router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName, sortOrder } = req.query;
        const pool = await getPool();
        const request = pool.request();

        const permissionResult = checkPermission(['readAny'], 'subjects', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }
        
        let query = "SELECT * FROM Subjects";
        let whereConditions = [];

        if (searchValue && searchValue !== "*") {
            whereConditions.push("Name LIKE '%' + @searchValue + '%'");
            request.input('searchValue', searchValue);
        }

        if (whereConditions.length > 0) {
            query += " WHERE " + whereConditions.join(" AND ");
        }

        const validSortName = sortName === "Name" ? "Name" : "Id";
        const validatedSortOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${validSortName} ${validatedSortOrder}`;

        let subjectsResult = await request.query(query);
        const count = subjectsResult.recordset.length;

        if (skip && limit) {
            query += " OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY";
            request.input('skip', parseInt(skip));
            request.input('limit', parseInt(limit));
        }

        subjectsResult = await request.query(query);
        const subjects = subjectsResult.recordset;

        return res.json({ issuccess: true, message: "", count, subjects });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subjects: [] });
    }
});

// Get a single subject by ID
router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Subjects WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Subject not found");
        }

        const permissionResult = checkPermission(['readOwn', 'readAny'], 'subjects', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        return res.json({ issuccess: true, message: "", count: 1, subject: result.recordset[0] });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subject: null });
    }
});

// Create a new subject
router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { Name } = req.body;
        const permissionResult = checkPermission(['createOwn', 'createAny'], 'subjects', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        const pool = await getPool();
        const dateCreated = new Date();

        const result = await pool.request()
            .input('Name', Name)
            .input('DateCreated', dateCreated)
            .query("INSERT INTO Subjects (Name, DateCreated) OUTPUT INSERTED.Id VALUES (@Name, @DateCreated)");
        
        const Id = result.recordset.length > 0 ? result.recordset[0].Id : 0;
        return res.json({ 
            issuccess: true, 
            message: "", 
            count: 1, 
            subject: { Id, Name, DateCreated: dateCreated } 
        });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subject: null });
    }
});

// Update an existing subject
router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Subjects WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Subject not found");
        }

        const permissionResult = checkPermission(['updateOwn', 'updateAny'], 'subjects', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        let subject = result.recordset[0];
        const { Name } = req.body;
        subject.Name = Name || subject.Name;

        await pool.request()
            .input('Name', subject.Name)
            .input('id', subject.Id)
            .query("UPDATE Subjects SET Name = @Name WHERE Id = @id");

        return res.json({ issuccess: true, message: "", count: 1, subject });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subject: null });
    }
});

// Delete a subject
router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Subjects WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Subject not found");
        }

        const permissionResult = checkPermission(['deleteOwn', 'deleteAny'], 'subjects', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        await pool.request()
            .input("id", req.params.id)
            .query("DELETE FROM Subjects WHERE Id = @id");
        
        return res.json({ issuccess: true, message: "", count: 0, subject: null });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subject: null });
    }
});

module.exports = router;