const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        const { requiresInvite, searchValue } = req.query;
        const pool = await getPool();

        let query = "SELECT * FROM Schools";
        const params = [];
        const conditions = [];

        if (requiresInvite !== undefined) {
            conditions.push("RequiresInvite = ?");
            params.push(requiresInvite === 'true' ? 1 : 0);
        }
        if (searchValue && searchValue !== "*") {
            conditions.push("Name LIKE ?");
            params.push(`%${searchValue}%`);
        }
        if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
        query += " ORDER BY Name";

        const [rows] = await pool.query(query, params);
        return res.json({ issuccess: true, message: "", count: rows.length, schools: rows });
    } catch (err) {
        console.error("Error fetching schools:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, schools: [] });
    }
});

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Schools WHERE Id = ?", [id]);
        if (rows.length === 0) throw new Error("School not found");

        const perm = checkPermission(['readOwn', 'readAny'], 'schools', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        return res.json({ issuccess: true, message: "", count: 1, school: rows[0] });
    } catch (err) {
        console.error("Error fetching school:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, school: null });
    }
});

router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { Name, Description, RequiresInvite } = req.body;

        const perm = checkPermission(['createOwn', 'createAny'], 'schools', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const pool = await getPool();
        const dateCreated = new Date();
        const reqInv = RequiresInvite !== undefined ? !!RequiresInvite : false;

        const [result] = await pool.query(
            "INSERT INTO Schools (Name, Description, RequiresInvite, DateCreated) VALUES (?, ?, ?, ?)",
            [Name, Description || '', reqInv, dateCreated]
        );

        return res.json({
            issuccess: true, message: "", count: 1,
            school: { Id: result.insertId, Name, Description: Description || '', RequiresInvite: reqInv, DateCreated: dateCreated }
        });
    } catch (err) {
        console.error("Error creating school:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, school: null });
    }
});

router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { Name, Description, RequiresInvite } = req.body;
        const pool = await getPool();

        const [rows] = await pool.query("SELECT * FROM Schools WHERE Id = ?", [id]);
        if (rows.length === 0) throw new Error("School not found");

        const perm = checkPermission(['updateOwn', 'updateAny'], 'schools', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const school = rows[0];

        await pool.query(
            "UPDATE Schools SET Name = ?, Description = ?, RequiresInvite = ? WHERE Id = ?",
            [
                Name || school.Name,
                Description !== undefined ? Description : school.Description,
                RequiresInvite !== undefined ? !!RequiresInvite : school.RequiresInvite,
                id
            ]
        );

        const [updated] = await pool.query("SELECT * FROM Schools WHERE Id = ?", [id]);
        return res.json({ issuccess: true, message: "", count: 1, school: updated[0] });
    } catch (err) {
        console.error("Error updating school:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, school: null });
    }
});

router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const [rows] = await pool.query("SELECT * FROM Schools WHERE Id = ?", [id]);
        if (rows.length === 0) throw new Error("School not found");

        const perm = checkPermission(['deleteOwn', 'deleteAny'], 'schools', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        await pool.query("DELETE FROM Schools WHERE Id = ?", [id]);
        return res.json({ issuccess: true, message: "", count: 0, school: null });
    } catch (err) {
        console.error("Error deleting school:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, school: null });
    }
});

router.get("/users/:userId/schools", authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const pool = await getPool();

        const [rows] = await pool.query(`
            SELECT s.Id, s.Name, s.Description, s.RequiresInvite
            FROM Schools s
            JOIN UsersSchools us ON s.Id = us.SchoolId
            WHERE us.UserId = ?
            ORDER BY s.Name
        `, [userId]);

        return res.json({ issuccess: true, message: "", count: rows.length, schools: rows });
    } catch (err) {
        console.error("Error fetching user schools:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, schools: [] });
    }
});

router.post("/users/:userId/schools", authenticateToken, async (req, res) => {
    let conn;
    try {
        const { userId } = req.params;
        const { schoolIds } = req.body;
        const pool = await getPool();

        conn = await pool.getConnection();
        await conn.beginTransaction();

        await conn.query("DELETE FROM UsersSchools WHERE UserId = ?", [userId]);

        if (schoolIds && schoolIds.length > 0) {
            for (const schoolId of schoolIds) {
                await conn.query(
                    "INSERT INTO UsersSchools (UserId, SchoolId, DateAssigned) VALUES (?, ?, NOW())",
                    [userId, schoolId]
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
        `, [userId]);

        return res.json({ issuccess: true, message: "Schools assigned successfully", count: rows.length, schools: rows });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch {} conn.release(); }
        console.error("Error assigning user schools:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, schools: [] });
    }
});

router.get("/:schoolId/subjects", authenticateToken, async (req, res) => {
    try {
        const { schoolId } = req.params;
        const pool = await getPool();

        const [rows] = await pool.query(`
            SELECT s.Id, s.Name, s.Description
            FROM Subjects s
            JOIN SchoolSubjects ss ON s.Id = ss.SubjectId
            WHERE ss.SchoolId = ?
            ORDER BY s.Name
        `, [schoolId]);

        return res.json({ issuccess: true, message: "", count: rows.length, subjects: rows });
    } catch (err) {
        console.error("Error fetching school subjects:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subjects: [] });
    }
});

router.post("/:schoolId/subjects", authenticateToken, async (req, res) => {
    let conn;
    try {
        const { schoolId } = req.params;
        const { subjectIds } = req.body;
        const pool = await getPool();

        const perm = checkPermission(['updateAny'], 'schools', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        conn = await pool.getConnection();
        await conn.beginTransaction();

        await conn.query("DELETE FROM SchoolSubjects WHERE SchoolId = ?", [schoolId]);

        if (subjectIds && subjectIds.length > 0) {
            for (const subjectId of subjectIds) {
                await conn.query(
                    "INSERT INTO SchoolSubjects (SchoolId, SubjectId, DateAssigned) VALUES (?, ?, NOW())",
                    [schoolId, subjectId]
                );
            }
        }

        await conn.commit();
        conn.release();
        conn = null;

        const [rows] = await pool.query(`
            SELECT s.Id, s.Name, s.Description
            FROM Subjects s
            JOIN SchoolSubjects ss ON s.Id = ss.SubjectId
            WHERE ss.SchoolId = ?
            ORDER BY s.Name
        `, [schoolId]);

        return res.json({ issuccess: true, message: "Subjects assigned successfully", count: rows.length, subjects: rows });
    } catch (err) {
        if (conn) { try { await conn.rollback(); } catch {} conn.release(); }
        console.error("Error assigning school subjects:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, subjects: [] });
    }
});

module.exports = router;