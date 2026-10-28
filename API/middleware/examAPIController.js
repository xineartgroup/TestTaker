const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName, sortOrder } = req.query;
        const pool = await getPool();

        const perm = checkPermission(['readAny'], 'exams', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        let query = "SELECT Id, Name, SubjectId, Length, QuestionCount, QuestionType, DateCreated FROM Exams";
        const params = [];
        const where = [];

        if (searchValue && searchValue !== "*") {
            where.push("Name LIKE ?");
            params.push(`%${searchValue}%`);
        }
        if (where.length > 0) query += " WHERE " + where.join(" AND ");

        const validSortName = sortName === "Name" ? "Name" : (sortName === "Length" ? "Length" : "Id");
        const validOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${validSortName} ${validOrder}`;

        const [allRows] = await pool.query(query, params);
        const count = allRows.length;

        let exams = allRows;
        if (skip && limit) {
            const skipN = parseInt(skip), limitN = parseInt(limit);
            const [paged] = await pool.query(query + " LIMIT ? OFFSET ?", [...params, limitN, skipN]);
            exams = paged;
        }

        return res.json({ issuccess: true, message: "", count, exams });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exams: [] });
    }
});

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query(
            "SELECT Id, Name, SubjectId, Length, QuestionCount, QuestionType, DateCreated FROM Exams WHERE Id = ?",
            [req.params.id]
        );
        if (rows.length === 0) throw new Error("Exam not found");

        const perm = checkPermission(['readOwn', 'readAny'], 'exams', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        return res.json({ issuccess: true, message: "", count: 1, exam: rows[0] });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exam: null });
    }
});

router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { Name, SubjectId, Length, QuestionCount, QuestionType } = req.body;

        const perm = checkPermission(['createOwn', 'createAny'], 'exams', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const pool = await getPool();
        const dateCreated = new Date();
        const qc = QuestionCount || 0;
        const qt = QuestionType || 'Multiple Choice';

        const [result] = await pool.query(
            "INSERT INTO Exams (Name, SubjectId, Length, QuestionCount, QuestionType, DateCreated) VALUES (?, ?, ?, ?, ?, ?)",
            [Name, SubjectId, Length, qc, qt, dateCreated]
        );

        return res.json({
            issuccess: true, message: "", count: 1,
            exam: { Id: result.insertId, Name, SubjectId, Length, QuestionCount: qc, QuestionType: qt, DateCreated: dateCreated }
        });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exam: null });
    }
});

router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Exams WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Exam not found");

        const perm = checkPermission(['updateOwn', 'updateAny'], 'exams', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        const exam = rows[0];
        const { Name, SubjectId, Length, QuestionCount, QuestionType } = req.body;

        exam.Name = Name || exam.Name;
        exam.SubjectId = SubjectId !== undefined ? SubjectId : exam.SubjectId;
        exam.Length = Length !== undefined ? Length : exam.Length;
        exam.QuestionCount = QuestionCount !== undefined ? QuestionCount : exam.QuestionCount;
        exam.QuestionType = QuestionType || exam.QuestionType;

        await pool.query(
            "UPDATE Exams SET Name = ?, SubjectId = ?, Length = ?, QuestionCount = ?, QuestionType = ? WHERE Id = ?",
            [exam.Name, exam.SubjectId, exam.Length, exam.QuestionCount, exam.QuestionType, exam.Id]
        );

        return res.json({ issuccess: true, message: "", count: 1, exam });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exam: null });
    }
});

router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const [rows] = await pool.query("SELECT * FROM Exams WHERE Id = ?", [req.params.id]);
        if (rows.length === 0) throw new Error("Exam not found");

        const perm = checkPermission(['deleteOwn', 'deleteAny'], 'exams', req.user);
        if (!perm.issuccess) throw new Error(perm.message);

        await pool.query("DELETE FROM Exams WHERE Id = ?", [req.params.id]);
        return res.json({ issuccess: true, message: "", count: 0, exam: null });
    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exam: null });
    }
});

router.get("/take/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const [examRows] = await pool.query(
            "SELECT Id, Name, Length, QuestionCount, QuestionType FROM Exams WHERE Id = ?", [id]
        );
        if (examRows.length === 0) {
            return res.status(404).render('error', { title: 'Error', detail: 'Exam not found' });
        }
        const exam = examRows[0];

        const [allQuestions] = await pool.query("SELECT * FROM Questions WHERE ExamId = ?", [id]);
        if (allQuestions.length === 0) {
            return res.render('exam/no-questions', { title: 'No Questions', exam });
        }

        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 30);

        const questionsWithOptions = await Promise.all(selected.map(async (q) => {
            const [opts] = await pool.query("SELECT * FROM Options WHERE QuestionId = ?", [q.Id]);
            return { ...q, Options: opts };
        }));

        req.session.currentExam = {
            examId: id,
            examName: exam.Name,
            examLength: exam.Length || 60,
            questionType: exam.QuestionType || 'Multiple Choice',
            questions: questionsWithOptions,
            currentIndex: 0,
            answers: {},
            startTime: null,
            isActive: false,
            userId: req.user.Id
        };

        return res.render('exam/start', {
            title: `Exam: ${exam.Name}`,
            exam,
            totalQuestions: questionsWithOptions.length
        });
    } catch (err) {
        console.error("Error starting exam:", err);
        return res.status(500).render('error', { title: 'Error', detail: 'Failed to start exam: ' + err.message });
    }
});

router.get("/take/:id/start", authenticateToken, async (req, res) => {
    try {
        if (!req.session.currentExam || req.session.currentExam.examId != req.params.id) {
            return res.redirect(`/exams/take/${req.params.id}`);
        }
        req.session.currentExam.startTime = new Date();
        req.session.currentExam.isActive = true;
        req.session.currentExam.currentIndex = 0;
        return res.redirect(`/exams/take/${req.params.id}/question/0`);
    } catch (err) {
        return res.status(500).render('error', { title: 'Error', detail: 'Failed to start exam: ' + err.message });
    }
});

router.get('/take/:id/question/:index', authenticateToken, async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');

        const { id, index } = req.params;
        const questionIndex = parseInt(index);

        if (!req.session.currentExam ||
            req.session.currentExam.examId != id ||
            req.session.currentExam.userId != req.user.Id) {
            return res.redirect(`/exams/take/${id}`);
        }

        const exam = req.session.currentExam;
        if (!exam.isActive) return res.redirect(`/exams/take/${id}`);
        if (questionIndex >= exam.questions.length) return res.redirect(`/exams/take/${id}/complete`);

        const question = exam.questions[questionIndex];
        const totalQuestions = exam.questions.length;
        const progress = Math.round(((questionIndex + 1) / totalQuestions) * 100);

        const startTime = new Date(exam.startTime);
        const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
        const totalSeconds = exam.examLength ? exam.examLength * 60 : 3600;
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;

        return res.render('exams/take-question', {
            title: `Question ${questionIndex + 1} of ${totalQuestions}`,
            question, currentIndex: questionIndex, totalQuestions,
            progress, examName: exam.examName, examId: id,
            remainingMinutes: minutes, remainingSeconds: seconds,
            totalSeconds, elapsedSeconds,
            isLast: questionIndex === totalQuestions - 1,
            userAnswer: exam.answers[question.Id] || null
        });
    } catch (error) {
        console.error("Error loading question:", error);
        return res.render('error', { title: 'Error', detail: error.message || 'Failed to load question' });
    }
});

router.post('/take/:id/answer/:index', authenticateToken, async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.status(401).json({ success: false, error: 'Not logged in' });

        const { id, index } = req.params;
        const questionIndex = parseInt(index);
        const { answer } = req.body;

        if (!req.session.currentExam ||
            req.session.currentExam.examId != id ||
            req.session.currentExam.userId != req.user.Id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const exam = req.session.currentExam;
        const question = exam.questions[questionIndex];

        if (question.AnswerType === 0) {
            exam.answers[question.Id] = parseInt(answer);
        } else if (question.AnswerType === 1) {
            if (Array.isArray(answer)) exam.answers[question.Id] = answer.map(Number);
            else if (answer) exam.answers[question.Id] = [parseInt(answer)];
            else exam.answers[question.Id] = [];
        } else if (question.AnswerType === 2) {
            exam.answers[question.Id] = answer;
        }

        const nextIndex = questionIndex + 1;
        if (nextIndex >= exam.questions.length) {
            return res.json({ success: true, redirect: `/exams/take/${id}/complete`, completed: true });
        }
        return res.json({ success: true, redirect: `/exams/take/${id}/question/${nextIndex}`, nextIndex });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message || 'Failed to save answer' });
    }
});

router.get('/take/:id/complete', authenticateToken, async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.status(401).send('Session expired or invalid.');
        }

        const { id } = req.params;

        if (!req.session.currentExam ||
            req.session.currentExam.examId != id ||
            req.session.currentExam.userId != req.user.Id) {
            return res.status(400).send('Exam context mismatch or not found.');
        }

        const exam = req.session.currentExam;
        const pool = await getPool();

        const results = {
            totalQuestions: exam.questions.length,
            answered: 0,
            correct: 0,
            incorrect: 0,
            totalPoints: exam.questions.length,
            earnedPoints: 0,
            details: [],
            questionType: exam.questionType
        };

        for (const question of exam.questions) {
            const userAnswer = exam.answers[String(question.Id)];
            let isAnswered = false;
            let pointsEarned = 0;
            let maxPoints = 1;
            let userAnswerDisplay = null;

            if (question.AnswerType === 0) {
                isAnswered = userAnswer !== null && userAnswer !== undefined;
                if (isAnswered) {
                    const [opts] = await pool.query("SELECT * FROM Options WHERE Id = ?", [userAnswer]);
                    if (opts.length > 0) {
                        pointsEarned = opts[0].IsCorrect ? 1 : 0;
                        userAnswerDisplay = opts[0].Text || `Option ${userAnswer}`;
                    } else {
                        userAnswerDisplay = `Option ${userAnswer}`;
                    }
                }
                if (pointsEarned === maxPoints) results.correct++;
                else if (isAnswered) results.incorrect++;

            } else if (question.AnswerType === 1) {
                let userAnswers = [];
                if (Array.isArray(userAnswer)) userAnswers = userAnswer.map(Number);
                else if (userAnswer) userAnswers = [Number(userAnswer)];

                isAnswered = userAnswers.length > 0 && userAnswers[0] !== null && userAnswers[0] !== undefined;

                if (isAnswered) {
                    const [allOptions] = await pool.query("SELECT * FROM Options WHERE QuestionId = ?", [question.Id]);
                    const totalCorrect = allOptions.filter(o => o.IsCorrect === true).length;

                    if (totalCorrect > 0) {
                        let correctSelections = 0, incorrectSelections = 0;
                        userAnswers.forEach(aid => {
                            const opt = allOptions.find(o => o.Id === aid);
                            if (opt) opt.IsCorrect ? correctSelections++ : incorrectSelections++;
                        });
                        const w = 1 / totalCorrect;
                        pointsEarned = Math.max(0, (correctSelections * w) - (incorrectSelections * w));

                        if (pointsEarned === maxPoints) results.correct++;
                        else if (isAnswered) results.incorrect++;

                        userAnswerDisplay = userAnswers.map(aid => {
                            const opt = allOptions.find(o => o.Id === aid);
                            return opt ? opt.Text : `Option ${aid}`;
                        }).join(', ');
                    }
                }

            } else if (question.AnswerType === 2) {
                isAnswered = userAnswer !== null && userAnswer !== undefined && userAnswer !== '';
                userAnswerDisplay = userAnswer || null;
                pointsEarned = 0;
            }

            if (isAnswered) results.answered++;
            results.earnedPoints += pointsEarned;

            let correctAnswerText = null;
            if (question.AnswerType === 0 || question.AnswerType === 1) {
                const [correctOpts] = await pool.query(
                    "SELECT * FROM Options WHERE QuestionId = ? AND IsCorrect = 1", [question.Id]
                );
                if (correctOpts.length > 0) correctAnswerText = correctOpts.map(o => o.Text).join(', ');
            } else if (question.AnswerType === 2) {
                correctAnswerText = 'Manual review required';
            }

            results.details.push({
                questionId: question.Id,
                text: question.Text,
                userAnswer,
                userAnswerText: userAnswerDisplay,
                isAnswered,
                answerType: question.AnswerType,
                correctAnswer: correctAnswerText,
                pointsEarned,
                maxPoints
            });
        }

        const examName = exam.examName;
        const percentage = results.totalPoints > 0
            ? Math.round((results.earnedPoints / results.totalPoints) * 100)
            : 0;

        delete req.session.currentExam;

        return res.render('exams/take-complete', {
            title: 'Exam Complete',
            results,
            examName,
            percentage,
            questionType: exam.questionType
        });
    } catch (error) {
        return res.status(500).render('error', { title: 'Error', detail: error.message || 'Failed to complete exam' });
    }
});

module.exports = router;