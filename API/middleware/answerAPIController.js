const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

// Get all answers for a user (with optional exam filter)
router.get("/", authenticateToken, async (req, res) => {
    try {
        const { examId, questionId } = req.query;
        const userId = req.user.Id;
        const pool = await getPool();
        
        let query = "SELECT * FROM Answers WHERE UserId = @userId";
        let request = pool.request().input('userId', userId);
        
        if (examId) {
            query += " AND ExamId = @examId";
            request.input('examId', examId);
        }
        
        if (questionId) {
            query += " AND QuestionId = @questionId";
            request.input('questionId', questionId);
        }
        
        const result = await request.query(query);
        
        return res.json({ 
            issuccess: true, 
            message: "", 
            count: result.recordset ? result.recordset.length : 0, 
            answers: result.recordset || [] 
        });
        
    } catch (err) {
        console.error("Error fetching answers:", err);
        return res.json({ 
            issuccess: false, 
            message: "Server Error: " + err.message, 
            count: 0, 
            answers: [] 
        });
    }
});

// Get a specific answer by ID
router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.Id;
        const pool = await getPool();
        
        let query = "SELECT * FROM Answers WHERE Id = @id";
        let request = pool.request().input('id', id);
        
        if (req.user.Role !== 'Administrator') {
            query += " AND UserId = @userId";
            request.input('userId', userId);
        }
        
        const result = await request.query(query);
        
        if (!result.recordset || result.recordset.length === 0) {
            throw new Error("Answer not found or access denied");
        }
        
        return res.json({ 
            issuccess: true, 
            message: "", 
            count: 1, 
            answer: result.recordset[0] 
        });
        
    } catch (err) {
        console.error("Error fetching answer:", err);
        return res.json({ 
            issuccess: false, 
            message: "Server Error: " + err.message, 
            count: 0, 
            answer: null 
        });
    }
});

// Save or update an answer
router.post("/save", authenticateToken, async (req, res) => {
    try {
        const { examId, questionId, answerText, answerOptionId } = req.body;
        const userId = req.user.Id;
        const pool = await getPool();
        
        console.log("Saving answer:", { examId, questionId, userId, answerText, answerOptionId });
        
        if (!examId || !questionId) {
            throw new Error("ExamId and QuestionId are required");
        }
        
        const questionResult = await pool.request()
            .input('questionId', questionId)
            .query("SELECT AnswerType FROM Questions WHERE Id = @questionId");
        
        if (!questionResult.recordset || questionResult.recordset.length === 0) {
            throw new Error("Question not found");
        }
        
        const answerType = questionResult.recordset[0].AnswerType;
        let pointsEarned = 0;
        
        if (answerType === 0) {
            // Single choice - calculate points immediately
            if (answerOptionId) {
                const optionResult = await pool.request()
                    .input('optionId', answerOptionId)
                    .query("SELECT IsCorrect FROM Options WHERE Id = @optionId");
                
                if (optionResult.recordset && optionResult.recordset.length > 0) {
                    const isCorrect = optionResult.recordset[0].IsCorrect ? 1 : 0;
                    pointsEarned = isCorrect === 1 ? 1 : 0;
                }
            }
        } else if (answerType === 1) {
            // Multiple choice - calculate partial points immediately
            if (answerOptionId) {
                // Parse the comma-separated string
                let userAnswers = [];
                if (typeof answerOptionId === 'string' && answerOptionId.includes(',')) {
                    userAnswers = answerOptionId.split(',').map(a => parseInt(a.trim()));
                } else if (Array.isArray(answerOptionId)) {
                    userAnswers = answerOptionId;
                } else {
                    userAnswers = [parseInt(answerOptionId)];
                }
                
                // Get all options for this question
                const optionsResult = await pool.request()
                    .input('questionId', questionId)
                    .query("SELECT Id, IsCorrect FROM Options WHERE QuestionId = @questionId");
                
                if (optionsResult.recordset && optionsResult.recordset.length > 0) {
                    const allOptions = optionsResult.recordset;
                    const correctOptions = allOptions.filter(o => o.IsCorrect === true);
                    const totalCorrect = correctOptions.length;
                    
                    if (totalCorrect > 0) {
                        let correctSelections = 0;
                        let incorrectSelections = 0;
                        
                        userAnswers.forEach(answerId => {
                            const option = allOptions.find(o => o.Id === answerId);
                            if (option) {
                                if (option.IsCorrect) {
                                    correctSelections++;
                                } else {
                                    incorrectSelections++;
                                }
                            }
                        });
                        
                        const weightPerCorrect = 1 / totalCorrect;
                        let calculatedPoints = (correctSelections * weightPerCorrect) - (incorrectSelections * weightPerCorrect);
                        pointsEarned = Math.max(0, calculatedPoints);
                    }
                }
            }
        } else if (answerType === 2) {
            // Text answer - needs manual grading
            pointsEarned = 0;
        }
        
        const checkResult = await pool.request()
            .input('examId', examId)
            .input('userId', userId)
            .input('questionId', questionId)
            .query("SELECT Id FROM Answers WHERE ExamId = @examId AND UserId = @userId AND QuestionId = @questionId");
        
        console.log("Check result:", checkResult.recordset);
        
        if (checkResult.recordset && checkResult.recordset.length > 0) {
            const answerId = checkResult.recordset[0].Id;
            await pool.request()
                .input('id', answerId)
                .input('answerText', answerText || null)
                .input('answerOptionId', answerOptionId || null)
                .input('pointsEarned', pointsEarned)
                .query(`
                    UPDATE Answers 
                    SET AnswerText = @answerText, 
                        AnswerOptionId = @answerOptionId,
                        PointsEarned = @pointsEarned,
                        DateCreated = GETDATE()
                    WHERE Id = @id
                `);
            
            console.log(`Updated answer ID: ${answerId} with points: ${pointsEarned}`);
        } else {
            await pool.request()
                .input('examId', examId)
                .input('userId', userId)
                .input('questionId', questionId)
                .input('answerText', answerText || null)
                .input('answerOptionId', answerOptionId || null)
                .input('pointsEarned', pointsEarned)
                .query(`
                    INSERT INTO Answers (ExamId, UserId, QuestionId, AnswerText, AnswerOptionId, PointsEarned, DateCreated)
                    VALUES (@examId, @userId, @questionId, @answerText, @answerOptionId, @pointsEarned, GETDATE())
                `);
            
            console.log(`Inserted answer for question ${questionId} with points: ${pointsEarned}`);
        }
        
        return res.json({ 
            issuccess: true, 
            message: "Answer saved successfully",
            pointsEarned: pointsEarned
        });
        
    } catch (err) {
        console.error("Error saving answer:", err);
        return res.json({ 
            issuccess: false, 
            message: "Server Error: " + err.message 
        });
    }
});

// Grade an answer (admin or teacher)
router.post("/grade/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { pointsEarned } = req.body;
        const pool = await getPool();
        
        const permissionResult = checkPermission(['updateAny'], 'answers', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }
        
        await pool.request()
            .input('id', id)
            .input('pointsEarned', pointsEarned || 0)
            .query(`
                UPDATE Answers 
                SET PointsEarned = @pointsEarned
                WHERE Id = @id
            `);
        
        return res.json({ 
            issuccess: true, 
            message: "Answer graded successfully" 
        });
        
    } catch (err) {
        console.error("Error grading answer:", err);
        return res.json({ 
            issuccess: false, 
            message: "Server Error: " + err.message 
        });
    }
});

// Delete an answer (admin only)
router.delete("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        const permissionResult = checkPermission(['deleteAny'], 'answers', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }
        
        await pool.request()
            .input('id', id)
            .query("DELETE FROM Answers WHERE Id = @id");
        
        return res.json({ 
            issuccess: true, 
            message: "Answer deleted successfully" 
        });
        
    } catch (err) {
        console.error("Error deleting answer:", err);
        return res.json({ 
            issuccess: false, 
            message: "Server Error: " + err.message 
        });
    }
});

// Get answers for a specific exam
router.get("/exam/:examId", authenticateToken, async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user.Id;
        const pool = await getPool();
        
        let query = `
            SELECT a.*, 
                   q.Text as QuestionText,
                   q.AnswerType
            FROM Answers a
            JOIN Questions q ON a.QuestionId = q.Id
            WHERE a.ExamId = @examId
        `;
        
        let request = pool.request().input('examId', examId);
        
        if (req.user.Role !== 'Administrator') {
            query += " AND a.UserId = @userId";
            request.input('userId', userId);
        }
        
        const result = await request.query(query);
        
        return res.json({ 
            issuccess: true, 
            message: "", 
            count: result.recordset ? result.recordset.length : 0, 
            answers: result.recordset || [] 
        });
        
    } catch (err) {
        console.error("Error fetching exam answers:", err);
        return res.json({ 
            issuccess: false, 
            message: "Server Error: " + err.message, 
            count: 0, 
            answers: [] 
        });
    }
});

module.exports = router;