const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

// Get all schools
router.get("/", authenticateToken, async (req, res) => {
    try {
        console.log("Fetching schools with query parameters:", req.query);
        
        const { requiresInvite, searchValue } = req.query;
        const pool = await getPool();
        let request = pool.request();
        
        let query = "SELECT * FROM Schools";
        let conditions = [];

        console.log("Query parameters:", { requiresInvite, searchValue });
        
        if (requiresInvite !== undefined) {
            conditions.push("RequiresInvite = @requiresInvite");
            request.input('requiresInvite', requiresInvite === 'true' ? 1 : 0);
        }
        
        if (searchValue && searchValue !== "*") {
            conditions.push("Name LIKE '%' + @searchValue + '%'");
            request.input('searchValue', searchValue);
        }
        
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        
        query += " ORDER BY Name";
        
        const result = await request.query(query);
        
        return res.json({
            issuccess: true,
            message: "",
            count: result.recordset.length,
            schools: result.recordset
        });
    } catch (err) {
        console.error("Error fetching schools:", err);
        return res.json({
            issuccess: false,
            message: "Server Error: " + err.message,
            count: 0,
            schools: []
        });
    }
});

// Get a single school by ID
router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        const result = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Schools WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("School not found");
        }

        const permissionResult = checkPermission(['readOwn', 'readAny'], 'schools', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        return res.json({
            issuccess: true,
            message: "",
            count: 1,
            school: result.recordset[0]
        });
    } catch (err) {
        console.error("Error fetching school:", err);
        return res.json({
            issuccess: false,
            message: "Server Error: " + err.message,
            count: 0,
            school: null
        });
    }
});

// Create a new school
router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { Name, Description, RequiresInvite } = req.body;
        
        const permissionResult = checkPermission(['createOwn', 'createAny'], 'schools', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        const pool = await getPool();
        const dateCreated = new Date();

        const result = await pool.request()
            .input('Name', Name)
            .input('Description', Description || '')
            .input('RequiresInvite', RequiresInvite !== undefined ? RequiresInvite : false)
            .input('DateCreated', dateCreated)
            .query("INSERT INTO Schools (Name, Description, RequiresInvite, DateCreated) OUTPUT INSERTED.Id VALUES (@Name, @Description, @RequiresInvite, @DateCreated)");
        
        const Id = result.recordset.length > 0 ? result.recordset[0].Id : 0;
        
        return res.json({
            issuccess: true,
            message: "",
            count: 1,
            school: { Id, Name, Description, RequiresInvite: RequiresInvite !== undefined ? RequiresInvite : false, DateCreated: dateCreated }
        });
    } catch (err) {
        console.error("Error creating school:", err);
        return res.json({
            issuccess: false,
            message: "Server Error: " + err.message,
            count: 0,
            school: null
        });
    }
});

// Update a school
router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { Name, Description, RequiresInvite } = req.body;
        const pool = await getPool();
        
        // Check if school exists
        const checkResult = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Schools WHERE Id = @id");

        if (checkResult.recordset.length === 0) {
            throw new Error("School not found");
        }

        const permissionResult = checkPermission(['updateOwn', 'updateAny'], 'schools', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        const school = checkResult.recordset[0];
        
        await pool.request()
            .input('id', id)
            .input('Name', Name || school.Name)
            .input('Description', Description !== undefined ? Description : school.Description)
            .input('RequiresInvite', RequiresInvite !== undefined ? RequiresInvite : school.RequiresInvite)
            .query("UPDATE Schools SET Name = @Name, Description = @Description, RequiresInvite = @RequiresInvite WHERE Id = @id");

        const updatedResult = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Schools WHERE Id = @id");

        return res.json({
            issuccess: true,
            message: "",
            count: 1,
            school: updatedResult.recordset[0]
        });
    } catch (err) {
        console.error("Error updating school:", err);
        return res.json({
            issuccess: false,
            message: "Server Error: " + err.message,
            count: 0,
            school: null
        });
    }
});

// Delete a school
router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        // Check if school exists
        const checkResult = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Schools WHERE Id = @id");

        if (checkResult.recordset.length === 0) {
            throw new Error("School not found");
        }

        const permissionResult = checkPermission(['deleteOwn', 'deleteAny'], 'schools', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        // Delete the school (cascade will handle UsersSchools and SchoolSubjects)
        await pool.request()
            .input("id", id)
            .query("DELETE FROM Schools WHERE Id = @id");
        
        return res.json({
            issuccess: true,
            message: "",
            count: 0,
            school: null
        });
    } catch (err) {
        console.error("Error deleting school:", err);
        return res.json({
            issuccess: false,
            message: "Server Error: " + err.message,
            count: 0,
            school: null
        });
    }
});

// Get schools for a user
router.get("/users/:userId/schools", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const pool = await getPool();
        
        const result = await pool.request()
            .input('userId', userId)
            .query(`
                SELECT s.Id, s.Name, s.Description, s.RequiresInvite
                FROM Schools s
                JOIN UsersSchools us ON s.Id = us.SchoolId
                WHERE us.UserId = @userId
                ORDER BY s.Name
            `);
        
        return res.json({
            issuccess: true,
            message: "",
            count: result.recordset.length,
            schools: result.recordset
        });
    } catch (err) {
        console.error("Error fetching user schools:", err);
        return res.json({
            issuccess: false,
            message: "Server Error: " + err.message,
            count: 0,
            schools: []
        });
    }
});

// Assign user to schools
router.post("/users/:userId/schools", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { schoolIds } = req.body; // Array of school IDs
        const pool = await getPool();
        
        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            // Remove existing school assignments
            await transaction.request()
                .input('userId', userId)
                .query("DELETE FROM UsersSchools WHERE UserId = @userId");
            
            // Add new school assignments
            if (schoolIds && schoolIds.length > 0) {
                for (const schoolId of schoolIds) {
                    await transaction.request()
                        .input('userId', userId)
                        .input('schoolId', schoolId)
                        .query(`
                            INSERT INTO UsersSchools (UserId, SchoolId, DateAssigned)
                            VALUES (@userId, @schoolId, GETDATE())
                        `);
                }
            }
            
            await transaction.commit();
            
            // Get updated schools list
            const result = await pool.request()
                .input('userId', userId)
                .query(`
                    SELECT s.Id, s.Name, s.Description, s.RequiresInvite
                    FROM Schools s
                    JOIN UsersSchools us ON s.Id = us.SchoolId
                    WHERE us.UserId = @userId
                    ORDER BY s.Name
                `);
            
            return res.json({
                issuccess: true,
                message: "Schools assigned successfully",
                count: result.recordset.length,
                schools: result.recordset
            });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Error assigning user schools:", err);
        return res.json({
            issuccess: false,
            message: "Server Error: " + err.message,
            count: 0,
            schools: []
        });
    }
});

// Get subjects for a school
router.get("/:schoolId/subjects", authenticateToken, async (req, res) => {
    try {
        const { schoolId } = req.params;
        const pool = await getPool();
        
        const result = await pool.request()
            .input('schoolId', schoolId)
            .query(`
                SELECT s.Id, s.Name, s.Description
                FROM Subjects s
                JOIN SchoolSubjects ss ON s.Id = ss.SubjectId
                WHERE ss.SchoolId = @schoolId
                ORDER BY s.Name
            `);
        
        return res.json({
            issuccess: true,
            message: "",
            count: result.recordset.length,
            subjects: result.recordset
        });
    } catch (err) {
        console.error("Error fetching school subjects:", err);
        return res.json({
            issuccess: false,
            message: "Server Error: " + err.message,
            count: 0,
            subjects: []
        });
    }
});

// Assign subjects to a school
router.post("/:schoolId/subjects", authenticateToken, async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { subjectIds } = req.body; // Array of subject IDs
        const pool = await getPool();
        
        const permissionResult = checkPermission(['updateAny'], 'schools', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }
        
        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            // Remove existing subject assignments
            await transaction.request()
                .input('schoolId', schoolId)
                .query("DELETE FROM SchoolSubjects WHERE SchoolId = @schoolId");
            
            // Add new subject assignments
            if (subjectIds && subjectIds.length > 0) {
                for (const subjectId of subjectIds) {
                    await transaction.request()
                        .input('schoolId', schoolId)
                        .input('subjectId', subjectId)
                        .query(`
                            INSERT INTO SchoolSubjects (SchoolId, SubjectId, DateAssigned)
                            VALUES (@schoolId, @subjectId, GETDATE())
                        `);
                }
            }
            
            await transaction.commit();
            
            // Get updated subjects list
            const result = await pool.request()
                .input('schoolId', schoolId)
                .query(`
                    SELECT s.Id, s.Name, s.Description
                    FROM Subjects s
                    JOIN SchoolSubjects ss ON s.Id = ss.SubjectId
                    WHERE ss.SchoolId = @schoolId
                    ORDER BY s.Name
                `);
            
            return res.json({
                issuccess: true,
                message: "Subjects assigned successfully",
                count: result.recordset.length,
                subjects: result.recordset
            });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error("Error assigning school subjects:", err);
        return res.json({
            issuccess: false,
            message: "Server Error: " + err.message,
            count: 0,
            subjects: []
        });
    }
});

module.exports = router;