const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        const { examId, questionId, sessionId } = req.query;
        const userId = req.user.Id;
        const pool = await getPool();

        let query = "SELECT * FROM Answers WHERE UserId = ?";
        const params = [userId];

        if (examId)      { query += " AND ExamId = ?";     params.push(examId); }
        if (questionId)  { query += " AND QuestionId = ?"; params.push(questionId); }
        if (sessionId)   { query += " AND SessionId = ?";  params.push(sessionId); }

        const [rows] = await pool.query(query, params);

        return res.json({ issuccess: true, message: "", count: rows.length, answers: rows });
    } catch (err) {
        console.error("Error fetching answers:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, answers: [] });
    }
});

router.get("/scores", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.Id;
        const pool = await getPool();

        const [rows] = await pool.query(`
            SELECT
                a.SessionId,
                a.ExamId,
                e.Name AS ExamName,
                COUNT(DISTINCT a.QuestionId) AS TotalQuestions,
                SUM(a.PointsEarned) AS EarnedPoints,
                COUNT(DISTINCT a.QuestionId) AS TotalPoints,
                MAX(a.DateCreated) AS DateCreated,
                TIMESTAMPDIFF(MINUTE, MIN(a.DateCreated), MAX(a.DateCreated)) AS DurationMinutes
            FROM Answers a
            JOIN Exams e ON a.ExamId = e.Id
            WHERE a.UserId = ?
            GROUP BY a.SessionId, a.ExamId, e.Name
            ORDER BY MAX(a.DateCreated) DESC
        `, [userId]);

        const scores = rows.map(row => {
            const totalPoints = Number(row.TotalPoints || 1);
            const earnedPoints = Number(row.EarnedPoints || 0);
            const percentage = Math.round((earnedPoints / totalPoints) * 100);
            return {
                SessionId: row.SessionId,
                ExamId: row.ExamId,
                ExamName: row.ExamName,
                TotalQuestions: row.TotalQuestions,
                Correct: Math.round(earnedPoints),
                EarnedPoints: earnedPoints,
                TotalPoints: totalPoints,
                Percentage: percentage,
                DateCreated: row.DateCreated,
                Duration: row.DurationMinutes != null ? `${row.DurationMinutes} mins` : 'N/A'
            };
        });

        return res.json({ issuccess: true, message: "", count: scores.length, scores });
    } catch (err) {
        console.error("Error fetching scores:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, scores: [] });
    }
});

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.Id;
        const pool = await getPool();

        let query = "SELECT * FROM Answers WHERE Id = ?";
        const params = [id];

        if (req.user.Role !== 'Administrator') {
            query += " AND UserId = ?";
            params.push(userId);
        }

        const [rows] = await pool.query(query, params);
        if (rows.length === 0) throw new Error("Answer not found or access denied");

        return res.json({ issuccess: true, message: "", count: 1, answer: rows[0] });
    } catch (err) {
        console.error("Error fetching answer:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, answer: null });
    }
});

router.post("/save", authenticateToken, async (req, res) => {
    try {
        const { examId, questionId, answerText, answerOptionId, sessionId } = req.body;
        const userId = req.user.Id;
        const pool = await getPool();

        if (!examId || !questionId || !sessionId) {
            throw new Error("ExamId, QuestionId, and SessionId are required");
        }

        const [qRows] = await pool.query("SELECT AnswerType FROM Questions WHERE Id = ?", [questionId]);
        if (qRows.length === 0) throw new Error("Question not found");

        const answerType = qRows[0].AnswerType;
        let pointsEarned = 0;

        if (answerType === 0) {
            if (answerOptionId) {
                const [oRows] = await pool.query("SELECT IsCorrect FROM Options WHERE Id = ?", [answerOptionId]);
                if (oRows.length > 0) pointsEarned = oRows[0].IsCorrect ? 1 : 0;
            }
        } else if (answerType === 1) {
            if (answerOptionId) {
                let userAnswers = [];
                if (typeof answerOptionId === 'string' && answerOptionId.includes(',')) {
                    userAnswers = answerOptionId.split(',').map(a => parseInt(a.trim()));
                } else if (Array.isArray(answerOptionId)) {
                    userAnswers = answerOptionId.map(Number);
                } else {
                    userAnswers = [parseInt(answerOptionId)];
                }

                const [oRows] = await pool.query("SELECT Id, IsCorrect FROM Options WHERE QuestionId = ?", [questionId]);
                const allOptions = oRows;
                const totalCorrect = allOptions.filter(o => o.IsCorrect === true).length;

                if (totalCorrect > 0) {
                    let correctSelections = 0, incorrectSelections = 0;
                    userAnswers.forEach(aid => {
                        const opt = allOptions.find(o => o.Id === aid);
                        if (opt) opt.IsCorrect ? correctSelections++ : incorrectSelections++;
                    });
                    const w = 1 / totalCorrect;
                    pointsEarned = Math.max(0, (correctSelections * w) - (incorrectSelections * w));
                }
            }
        } else if (answerType === 2) {
            pointsEarned = 0;
        }

        const [existing] = await pool.query(
            "SELECT Id FROM Answers WHERE ExamId = ? AND UserId = ? AND QuestionId = ? AND SessionId = ?",
            [examId, userId, questionId, sessionId]
        );

        if (existing.length > 0) {
            await pool.query(
                `UPDATE Answers
                    SET AnswerText = ?, AnswerOptionId = ?, PointsEarned = ?, DateCreated = NOW()
                  WHERE Id = ?`,
                [answerText || null, answerOptionId || null, pointsEarned, existing[0].Id]
            );
        } else {
            await pool.query(
                `INSERT INTO Answers (ExamId, UserId, QuestionId, SessionId, AnswerText, AnswerOptionId, PointsEarned, DateCreated)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [examId, userId, questionId, sessionId, answerText || null, answerOptionId || null, pointsEarned]
            );
        }

        return res.json({ issuccess: true, message: "Answer saved successfully", pointsEarned });
    } catch (err) {
        console.error("Error saving answer:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message });
    }
});

router.post("/grade/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { pointsEarned } = req.body;
        const pool = await getPool();

        const perm = checkPermission(['updateAny'], 'answers', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        await pool.query("UPDATE Answers SET PointsEarned = ? WHERE Id = ?", [pointsEarned || 0, id]);
        return res.json({ issuccess: true, message: "Answer graded successfully" });
    } catch (err) {
        console.error("Error grading answer:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message });
    }
});

router.delete("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const perm = checkPermission(['deleteAny'], 'answers', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        await pool.query("DELETE FROM Answers WHERE Id = ?", [id]);
        return res.json({ issuccess: true, message: "Answer deleted successfully" });
    } catch (err) {
        console.error("Error deleting answer:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message });
    }
});

router.get("/exam/:examId", authenticateToken, async (req, res) => {
    try {
        const { examId } = req.params;
        const { sessionId } = req.query;
        const userId = req.user.Id;
        const pool = await getPool();

        let query = `
            SELECT a.*, q.Text AS QuestionText, q.AnswerType
            FROM Answers a
            JOIN Questions q ON a.QuestionId = q.Id
            WHERE a.ExamId = ?
        `;
        const params = [examId];

        if (sessionId) { query += " AND a.SessionId = ?"; params.push(sessionId); }
        if (req.user.Role !== 'Administrator') { query += " AND a.UserId = ?"; params.push(userId); }

        const [rows] = await pool.query(query, params);
        return res.json({ issuccess: true, message: "", count: rows.length, answers: rows });
    } catch (err) {
        console.error("Error fetching exam answers:", err);
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, answers: [] });
    }
});

module.exports = router;