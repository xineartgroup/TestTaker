const express = require("express");
const getPool = require('../middleware/sqlconnection');
const { authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName, sortOrder } = req.query;
        const pool = await getPool();
        const request = pool.request();

        const permissionResult = checkPermission(['readAny'], 'exams', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }
        
        let query = "SELECT * FROM Exams";
        let whereConditions = [];

        if (searchValue && searchValue !== "*") {
            whereConditions.push("Name LIKE '%' + @searchValue + '%'");
            request.input('searchValue', searchValue);
        }

        if (whereConditions.length > 0) {
            query += " WHERE " + whereConditions.join(" AND ");
        }

        const validSortName = sortName === "Name" ? "Name" : (sortName === "Length" ? "Length" : "Id");
        const validatedSortOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${validSortName} ${validatedSortOrder}`;

        let examsResult = await request.query(query);
        const count = examsResult.recordset.length;

        if (skip && limit) {
            query += " OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY";
            request.input('skip', parseInt(skip));
            request.input('limit', parseInt(limit));
        }

        examsResult = await request.query(query);
        const exams = examsResult.recordset;

        return res.json({ issuccess: true, message: "", count, exams });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exams: [] });
    }
});

router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Exams WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Exam not found");
        }

        const permissionResult = checkPermission(['readOwn', 'readAny'], 'exams', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        return res.json({ issuccess: true, message: "", count: 1, exam: result.recordset[0] });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exam: null });
    }
});

router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { Name, SubjectId, Length, QuestionCount } = req.body;
        const permissionResult = checkPermission(['createOwn', 'createAny'], 'exams', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        const pool = await getPool();
        const dateCreated = new Date();

        const questionCount = QuestionCount || 0;

        const result = await pool.request()
            .input('Name', Name)
            .input('SubjectId', SubjectId)
            .input('Length', Length)
            .input('QuestionCount', questionCount)
            .input('DateCreated', dateCreated)
            .query("INSERT INTO Exams (Name, SubjectId, Length, QuestionCount, DateCreated) OUTPUT INSERTED.Id VALUES (@Name, @SubjectId, @Length, @QuestionCount, @DateCreated)");
        
        const Id = result.recordset.length > 0 ? result.recordset[0].Id : 0;
        return res.json({ 
            issuccess: true, 
            message: "", 
            count: 1, 
            exam: { Id, Name, SubjectId, Length, QuestionCount: questionCount, DateCreated: dateCreated } 
        });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exam: null });
    }
});

router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Exams WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Exam not found");
        }

        const permissionResult = checkPermission(['updateOwn', 'updateAny'], 'exams', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        let exam = result.recordset[0];
        const { Name, SubjectId, Length, QuestionCount } = req.body;

        exam.Name = Name || exam.Name;
        exam.SubjectId = SubjectId !== undefined ? SubjectId : exam.SubjectId;
        exam.Length = Length !== undefined ? Length : exam.Length;
        exam.QuestionCount = QuestionCount !== undefined ? QuestionCount : exam.QuestionCount;

        await pool.request()
            .input('Name', exam.Name)
            .input('SubjectId', exam.SubjectId)
            .input('Length', exam.Length)
            .input('QuestionCount', exam.QuestionCount)
            .input('id', exam.Id)
            .query("UPDATE Exams SET Name = @Name, SubjectId = @SubjectId, Length = @Length, QuestionCount = @QuestionCount WHERE Id = @id");

        return res.json({ issuccess: true, message: "", count: 1, exam });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exam: null });
    }
});

router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Exams WHERE Id = @id");

        if (result.recordset.length === 0) {
            throw new Error("Exam not found");
        }

        const permissionResult = checkPermission(['deleteOwn', 'deleteAny'], 'exams', req.user);
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        await pool.request()
            .input("id", req.params.id)
            .query("DELETE FROM Exams WHERE Id = @id");
        
        return res.json({ issuccess: true, message: "", count: 0, exam: null });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, exam: null });
    }
});

router.get("/take/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        
        const examResult = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Exams WHERE Id = @id");
            
        if (examResult.recordset.length === 0) {
            return res.status(404).render('error', { 
                title: 'Error', 
                detail: 'Exam not found' 
            });
        }
        
        const exam = examResult.recordset[0];
        
        const questionsResult = await pool.request()
            .input("examId", id)
            .query("SELECT * FROM Questions WHERE ExamId = @examId");
            
        const allQuestions = questionsResult.recordset;
        
        if (allQuestions.length === 0) {
            return res.render('exam/no-questions', { 
                title: 'No Questions',
                exam: exam
            });
        }
        
        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffled.slice(0, 30);
        
        const questionsWithOptions = await Promise.all(selectedQuestions.map(async (question) => {
            const optionsResult = await pool.request()
                .input("questionId", question.Id)
                .query("SELECT * FROM Options WHERE QuestionId = @questionId");
                
            return {
                ...question,
                Options: optionsResult.recordset
            };
        }));
        
        req.session.currentExam = {
            examId: id,
            examName: exam.Name,
            questions: questionsWithOptions,
            currentIndex: 0,
            answers: {},
            startTime: null,
            isActive: false
        };
        
        return res.render('exam/start', {
            title: `Exam: ${exam.Name}`,
            exam: exam,
            totalQuestions: questionsWithOptions.length
        });
        
    } catch (err) {
        console.error("Error starting exam:", err);
        return res.status(500).render('error', {
            title: 'Error',
            detail: 'Failed to start exam: ' + err.message
        });
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
        return res.status(500).render('error', {
            title: 'Error',
            detail: 'Failed to start exam: ' + err.message
        });
    }
});

router.get('/take/:id/question/:index', authenticateToken, async (req, res) => {
    try {
        console.log('Accessing question route for exam:', req.params.id, 'index:', req.params.index);
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
        
        const { id, index } = req.params;
        const questionIndex = parseInt(index);
        
        if (!req.session.currentExam || 
            req.session.currentExam.examId != id ||
            req.session.currentExam.userId != req.user.id) {
            return res.redirect(`/exams/take/${id}`);
        }
        
        const exam = req.session.currentExam;
        
        if (!exam.isActive) {
            return res.redirect(`/exams/take/${id}`);
        }
        
        if (questionIndex >= exam.questions.length) {
            return res.redirect(`/exams/take/${id}/complete`);
        }
        
        const question = exam.questions[questionIndex];
        const totalQuestions = exam.questions.length;
        
        const progress = Math.round(((questionIndex + 1) / totalQuestions) * 100);
        
        const startTime = new Date(exam.startTime);
        const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
        const totalSeconds = 3600; 
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        
        console.log('=== DEBUG INFO ===');
        console.log('progress:', progress);
        console.log('totalSeconds:', totalSeconds);
        console.log('elapsedSeconds:', elapsedSeconds);
        console.log('remainingSeconds:', remainingSeconds);
        console.log('minutes:', minutes);
        console.log('seconds:', seconds);
        console.log('===================');
        
        return res.render('exams/take-question', {
            title: `Question ${questionIndex + 1} of ${totalQuestions}`,
            question: question,
            currentIndex: questionIndex,
            totalQuestions: totalQuestions,
            progress: progress, 
            examName: exam.examName,
            examId: id,
            remainingMinutes: minutes,
            remainingSeconds: seconds,
            totalSeconds: totalSeconds, 
            elapsedSeconds: elapsedSeconds, 
            isLast: questionIndex === totalQuestions - 1,
            userAnswer: exam.answers[question.Id] || null
        });
        
    } catch (error) {
        console.error("Error loading question:", error);
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to load question' 
        });
    }
});

router.post('/take/:id/answer/:index', authenticateToken, async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.status(401).json({ success: false, error: 'Not logged in' });
        }
        
        const { id, index } = req.params;
        const questionIndex = parseInt(index);
        const { answer } = req.body;
        
        if (!req.session.currentExam || 
            req.session.currentExam.examId != id ||
            req.session.currentExam.userId != req.user.id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        
        const exam = req.session.currentExam;
        const question = exam.questions[questionIndex];
        
        if (question.AnswerType === 0) {
            exam.answers[question.Id] = parseInt(answer);
        } else if (question.AnswerType === 1) {
            if (Array.isArray(answer)) {
                exam.answers[question.Id] = answer.map(Number);
            } else if (answer) {
                exam.answers[question.Id] = [parseInt(answer)];
            } else {
                exam.answers[question.Id] = [];
            }
        } else if (question.AnswerType === 2) {
            exam.answers[question.Id] = answer;
        }
        
        const nextIndex = questionIndex + 1;
        
        if (nextIndex >= exam.questions.length) {
            return res.json({ 
                success: true, 
                redirect: `/exams/take/${id}/complete`,
                completed: true
            });
        } else {
            return res.json({ 
                success: true, 
                redirect: `/exams/take/${id}/question/${nextIndex}`,
                nextIndex: nextIndex
            });
        }
        
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to save answer' 
        });
    }
});

router.get('/take/:id/complete', authenticateToken, async (req, res) => {
    try {
        // Express-session backup just to check session health if decoupled
        if (!req.session || !req.session.isLoggedIn) {
            return res.status(401).send('Session expired or invalid.');
        }
        
        console.log('Evaluating exam results for user:', req.user.id);
        
        const { id } = req.params;
        
        // Match user ID from token against the active session details
        if (!req.session.currentExam || 
            req.session.currentExam.examId != id ||
            req.session.currentExam.userId != req.user.id) {
            return res.status(400).send('Exam context mismatch or not found.');
        }
        
        const resultsAccess = checkExamResultsAccess(req.user, id, req.user.id);
        if (!resultsAccess.issuccess) {
            return res.status(403).render('error', { 
                title: 'Access Denied', 
                detail: resultsAccess.message 
            });
        }
        
        const exam = req.session.currentExam;
        const results = {
            totalQuestions: exam.questions.length,
            answered: Object.keys(exam.answers).length,
            correct: 0,
            incorrect: 0,
            details: []
        };

        for (const question of exam.questions) {
            const userAnswer = exam.answers[String(question.Id)];
            console.log(`Evaluating Question ID: ${question.Id}, User Answer:`, userAnswer);
            
            if (question.AnswerType === 0) {
                if (userAnswer) {
                    const optionResult = await makeApiRequest('GET', `/api/options/${userAnswer}`, req);
                    
                    if (optionResult.issuccess && optionResult.option) {
                        const isCorrect = optionResult.option.IsCorrect;
                        if (isCorrect) results.correct++;
                        else results.incorrect++;

                        results.details.push({
                            questionId: question.Id,
                            text: question.Text,
                            userAnswer: userAnswer,
                            isCorrect: isCorrect
                        });
                    } else {
                        results.details.push({ questionId: question.Id, text: question.Text, userAnswer: userAnswer, isCorrect: false });
                    }
                } else {
                    results.details.push({ questionId: question.Id, text: question.Text, userAnswer: null, isCorrect: false });
                }
            } else if (question.AnswerType === 1) {
                if (userAnswer && Array.isArray(userAnswer) && userAnswer.length > 0) {
                    const optionsResult = await makeApiRequest('GET', `/api/options?questionId=${question.Id}`, req);
                    const correctOptions = optionsResult.issuccess ? 
                        optionsResult.options.filter(opt => opt.IsCorrect).map(opt => opt.Id) : [];
                    
                    const userSelected = userAnswer.map(Number);
                    const userSet = new Set(userSelected);
                    const correctSet = new Set(correctOptions);
                    
                    const hasAllCorrect = correctOptions.every(id => userSet.has(id));
                    const hasNoIncorrect = userSelected.every(id => correctSet.has(id));
                    const allCorrect = hasAllCorrect && hasNoIncorrect && userSelected.length === correctOptions.length;
                    
                    if (allCorrect) results.correct++;
                    else results.incorrect++;
                    
                    results.details.push({
                        questionId: question.Id,
                        text: question.Text,
                        userAnswer: userAnswer,
                        isCorrect: allCorrect,
                        correctOptions: correctOptions,
                        userSelected: userSelected
                    });
                } else {
                    results.details.push({ questionId: question.Id, text: question.Text, userAnswer: null, isCorrect: false });
                }
            } else {
                results.details.push({ questionId: question.Id, text: question.Text, userAnswer: userAnswer || null, isCorrect: true });
            }
        }
        
        const examName = exam.examName;
        delete req.session.currentExam;
        
        // Render and stream the HTML back across our authenticated channel
        return res.render('exams/take-complete', {
            title: 'Exam Complete',
            results: results,
            examName: examName
        });
        
    } catch (error) {
        return res.status(500).render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to complete exam' 
        });
    }
});

module.exports = router;