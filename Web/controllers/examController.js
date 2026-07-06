const express = require("express");
const { makeApiRequest } = require("./_baseController");
const router = express.Router();

// Middleware to check authentication status
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.isLoggedIn) {
        return res.status(401).json({ 
            issuccess: false, 
            message: "Not authenticated" 
        });
    }
    
    // Set req.user from session data
    req.user = {
        Id: req.session.userId,
        Role: req.session.userRole || 'User'
    };
    
    next();
};

const fetchExams = async (skip, limit, req, searchValue, sortName, sortOrder) => {
    return await makeApiRequest('GET', `/api/exams?skip=${skip}&limit=${limit}&searchValue=${searchValue}&sortName=${sortName}&sortOrder=${sortOrder}`, req);
};

router.get("", requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let searchValue = req.query.searchValue ? encodeURIComponent(req.query.searchValue) : "*";
        let sortName = req.query.sortName || "Id";
        let sortOrder = req.query.sortOrder || "desc";

        const result = await fetchExams(skip, limit, req, searchValue, sortName, sortOrder);

        if (result.issuccess) {
            searchValue = decodeURIComponent(searchValue);
            if (searchValue === "*") searchValue = "";

            return res.render('exams/index', {
                title: 'Exam List',
                exams: result.exams,
                currentPage: page,
                totalPages: Math.ceil(result.count / limit),
                searchValue,
                sortName,
                sortOrder
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.get('/create', requireAuth, async (req, res) => {
    try {
        const subjectsResult = await makeApiRequest('GET', '/api/subjects?skip=0&limit=1000', req);
        return res.render('exams/create', { 
            title: 'New Exam', 
            subjects: subjectsResult.issuccess ? subjectsResult.subjects : [] 
        });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.post('/create', requireAuth, async (req, res) => {
    try {
        const result = await makeApiRequest('POST', '/api/exams/create', req, req.body);
        if (result.issuccess) return res.redirect('/exams');
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.get('/update/:id', requireAuth, async (req, res) => {
    try {
        const examResult = await makeApiRequest('GET', `/api/exams/${req.params.id}`, req);
        const subjectsResult = await makeApiRequest('GET', '/api/subjects?skip=0&limit=1000', req);

        if (examResult.issuccess) {
            return res.render('exams/update', { 
                title: 'Update Exam', 
                exam: examResult.exam,
                subjects: subjectsResult.issuccess ? subjectsResult.subjects : []
            });
        }
        return res.render('error', { title: 'Error', detail: examResult.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.post('/update/:id', requireAuth, async (req, res) => {
    try {
        const result = await makeApiRequest('POST', `/api/exams/update/${req.params.id}`, req, req.body);
        if (result.issuccess) return res.redirect('/exams');
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.get('/delete/:id', requireAuth, async (req, res) => {
    try {
        const result = await makeApiRequest('GET', `/api/exams/${req.params.id}`, req);
        if (result.issuccess) return res.render('exams/delete', { title: 'Delete Exam', exam: result.exam });
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.post('/delete/:id', requireAuth, async (req, res) => {
    try {
        const result = await makeApiRequest('POST', `/api/exams/delete/${req.params.id}`, req);
        if (result.issuccess) return res.redirect('/exams');
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

// Start exam - shows instructions and exam details
router.get('/take/:id', requireAuth, async (req, res) => {
    try {
        const examResult = await makeApiRequest('GET', `/api/exams/${req.params.id}`, req);
        if (!examResult.issuccess) {
            return res.render('error', { title: 'Error', detail: examResult.message });
        }
        
        const exam = examResult.exam;
        const questionsResult = await makeApiRequest('GET', `/api/questions?examId=${req.params.id}&limit=1000`, req);
        
        if (!questionsResult.issuccess) {
            return res.render('error', { title: 'Error', detail: questionsResult.message });
        }
        
        const allQuestions = questionsResult.questions || [];
        if (allQuestions.length === 0) {
            return res.render('exams/no-questions', { 
                title: 'No Questions Available',
                exam: exam
            });
        }
        
        let questionCount = exam.QuestionCount || allQuestions.length;
        if (questionCount > allQuestions.length || questionCount <= 0) {
            questionCount = allQuestions.length;
        }
        
        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffled.slice(0, questionCount);
        
        const questionsWithOptions = await Promise.all(
            selectedQuestions.map(async (question) => {
                const optionsResult = await makeApiRequest('GET', `/api/options?questionId=${question.Id}`, req);
                return {
                    ...question,
                    Options: optionsResult.issuccess ? optionsResult.options : []
                };
            })
        );
        
        // Generate a unique session ID for this exam attempt
        const sessionId = `${Date.now()}-${req.user.Id}-${exam.Id}`;
        
        req.session.currentExam = {
            examId: exam.Id,
            examName: exam.Name,
            sessionId: sessionId,
            userId: req.user.Id,
            examLength: exam.Length || 60,
            questionType: exam.QuestionType || 'Multiple Choice',
            questions: questionsWithOptions,
            currentIndex: 0,
            answers: {},
            startTime: null,
            isActive: false,
            questionCount: questionCount,
            totalAvailableQuestions: allQuestions.length
        };
        
        // Fetch any existing answers for this session
        const answersResult = await makeApiRequest('GET', `/api/answers?examId=${exam.Id}&sessionId=${sessionId}`, req);
        if (answersResult.issuccess && answersResult.answers.length > 0) {
            const answerMap = {};
            answersResult.answers.forEach(a => {
                if (a.AnswerOptionId && a.AnswerOptionId.includes(',')) {
                    answerMap[a.QuestionId] = a.AnswerOptionId.split(',').map(id => parseInt(id.trim()));
                } else if (a.AnswerOptionId) {
                    answerMap[a.QuestionId] = parseInt(a.AnswerOptionId);
                } else {
                    answerMap[a.QuestionId] = a.AnswerText;
                }
            });
            req.session.currentExam.answers = answerMap;
        }
        
        return res.render('exams/take-start', {
            title: `Exam: ${exam.Name}`,
            exam: exam,
            totalQuestions: questionsWithOptions.length,
            questionCount: questionCount,
            totalAvailableQuestions: allQuestions.length
        });
        
    } catch (error) {
        console.error("Error starting exam:", error);
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to start exam' 
        });
    }
});

// Begin the exam - starts timer and shows first question
router.get('/take/:id/start', requireAuth, async (req, res) => {
    try {
        if (!req.session.currentExam || req.session.currentExam.examId != req.params.id) {
            return res.redirect(`/exams/take/${req.params.id}`);
        }
        
        req.session.currentExam.startTime = new Date();
        req.session.currentExam.isActive = true;
        req.session.currentExam.currentIndex = 0;
        
        return res.redirect(`/exams/take/${req.params.id}/question/0`);
        
    } catch (error) {
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to start exam' 
        });
    }
});

// Show a specific question
router.get('/take/:id/question/:index', requireAuth, async (req, res) => {
    try {
        const { id, index } = req.params;
        const questionIndex = parseInt(index);
        
        if (!req.session.currentExam || req.session.currentExam.examId != id) {
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
        
        // Use the exam's Length (in minutes) from the session
        const totalSeconds = exam.examLength ? exam.examLength * 60 : 3600; // Default to 60 minutes if not set
        const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        
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
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to load question' 
        });
    }
});

// Submit an answer
router.post('/take/:id/answer/:index', requireAuth, async (req, res) => {
    try {
        const { id, index } = req.params;
        const questionIndex = parseInt(index);
        const { answer } = req.body;
        const userId = req.user.Id;
        
        if (!req.session.currentExam || req.session.currentExam.examId != id) {
            return res.status(400).json({ success: false, error: 'Exam session not found' });
        }
        
        const exam = req.session.currentExam;
        const question = exam.questions[questionIndex];
        
        let answerText = null;
        let answerOptionId = null;
        
        if (question.AnswerType === 0) {
            answerOptionId = parseInt(answer);
            exam.answers[question.Id] = answerOptionId;
        } else if (question.AnswerType === 1) {
            let selectedOptions = [];
            if (Array.isArray(answer)) {
                selectedOptions = answer.map(a => parseInt(a));
            } else if (typeof answer === 'string' && answer.includes(',')) {
                selectedOptions = answer.split(',').map(a => parseInt(a.trim()));
            } else {
                selectedOptions = [parseInt(answer)];
            }
            exam.answers[question.Id] = selectedOptions;
            answerOptionId = selectedOptions.join(',');
        } else if (question.AnswerType === 2) {
            answerText = answer;
            exam.answers[question.Id] = answer;
        }
        
        const saveResult = await makeApiRequest('POST', '/api/answers/save', req, {
            examId: id,
            questionId: question.Id,
            sessionId: exam.sessionId,
            answerText: answerText,
            answerOptionId: answerOptionId
        });
        
        if (!saveResult.issuccess) {
            console.error('Failed to save answer to database:', saveResult.message);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to save answer to database. Please try again.' 
            });
        }
        
        console.log(`Answer saved to database for question ${question.Id}`);
        
        const nextIndex = questionIndex + 1;
        const isCompleted = nextIndex >= exam.questions.length;
        const redirectUrl = isCompleted 
            ? `/exams/take/${id}/complete` 
            : `/exams/take/${id}/question/${nextIndex}`;
        
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ success: false, error: 'Failed to persist answer' });
            }
            
            return res.json({ 
                success: true, 
                redirect: redirectUrl,
                completed: isCompleted,
                nextIndex: isCompleted ? null : nextIndex
            });
        });
        
    } catch (error) {
        console.error("Error saving answer:", error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Failed to save answer' 
        });
    }
});

// Complete the exam and show results
router.get('/take/:id/complete', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.Id;
        
        if (!req.session.currentExam || req.session.currentExam.examId != id) {
            return res.redirect(`/exams/take/${id}`);
        }
        
        const exam = req.session.currentExam;
        const sessionId = exam.sessionId;
        
        // Get all answers from database for this session
        const answersResult = await makeApiRequest('GET', `/api/answers?examId=${id}&sessionId=${sessionId}`, req);
        const dbAnswers = answersResult.issuccess ? answersResult.answers : [];
        
        // Build answer map from database
        const dbAnswerMap = {};
        dbAnswers.forEach(a => {
            dbAnswerMap[a.QuestionId] = {
                answerOptionId: a.AnswerOptionId,
                answerText: a.AnswerText,
                pointsEarned: a.PointsEarned
            };
        });
        
        const results = {
            totalQuestions: exam.questions.length,
            answered: 0,
            correct: 0,
            incorrect: 0,
            totalPoints: 0,
            earnedPoints: 0,
            details: [],
            questionType: exam.questionType
        };
        
        for (const question of exam.questions) {
            const userAnswerData = dbAnswerMap[question.Id];
            const pointsEarned = userAnswerData?.pointsEarned || 0;
            const isAnswered = userAnswerData !== undefined;
            
            if (isAnswered) {
                results.answered++;
                if (pointsEarned >= 1) {
                    results.correct++;
                } else {
                    results.incorrect++;
                }
            }
            
            results.totalPoints += 1;
            results.earnedPoints += pointsEarned;
            
            let userAnswerText = null;
            let userAnswer = null;
            
            if (question.AnswerType === 0 || question.AnswerType === 1) {
                const answerValue = userAnswerData?.answerOptionId || null;
                if (answerValue) {
                    if (question.AnswerType === 1 && typeof answerValue === 'string' && answerValue.includes(',')) {
                        const optionIds = answerValue.split(',').map(a => parseInt(a.trim()));
                        userAnswer = optionIds;
                        const optionsResult = await makeApiRequest('GET', `/api/options?questionId=${question.Id}`, req);
                        if (optionsResult.issuccess) {
                            const texts = optionIds.map(id => {
                                const option = optionsResult.options.find(o => o.Id === id);
                                return option ? option.Text : `Option ${id}`;
                            });
                            userAnswerText = texts.join(', ');
                        } else {
                            userAnswerText = optionIds.map(a => `Option ${a}`).join(', ');
                        }
                    } else {
                        userAnswer = parseInt(answerValue);
                        const optionResult = await makeApiRequest('GET', `/api/options/${userAnswer}`, req);
                        if (optionResult.issuccess && optionResult.option) {
                            userAnswerText = optionResult.option.Text;
                        } else {
                            userAnswerText = `Option ${userAnswer}`;
                        }
                    }
                }
            } else if (question.AnswerType === 2) {
                userAnswer = userAnswerData?.answerText || null;
                userAnswerText = userAnswer;
            }
            
            let correctAnswerText = null;
            if (question.AnswerType === 0 || question.AnswerType === 1) {
                const optionsResult = await makeApiRequest('GET', `/api/options?questionId=${question.Id}`, req);
                if (optionsResult.issuccess) {
                    const correctOptions = optionsResult.options.filter(o => o.IsCorrect === true);
                    if (correctOptions.length > 0) {
                        correctAnswerText = correctOptions.map(o => o.Text).join(', ');
                    }
                }
            } else if (question.AnswerType === 2) {
                correctAnswerText = 'Manual review required';
            }
            
            results.details.push({
                questionId: question.Id,
                text: question.Text,
                userAnswer: userAnswer,
                userAnswerText: userAnswerText,
                isAnswered: isAnswered,
                answerType: question.AnswerType,
                correctAnswer: correctAnswerText,
                pointsEarned: pointsEarned,
                maxPoints: 1
            });
        }
        
        const examName = exam.examName;
        const percentage = results.totalPoints > 0 
            ? Math.round((results.earnedPoints / results.totalPoints) * 100) 
            : 0;
        
        delete req.session.currentExam;
        
        return res.render('exams/take-complete', {
            title: 'Exam Complete',
            results: results,
            examName: examName,
            percentage: percentage,
            questionType: exam.questionType
        });
        
    } catch (error) {
        console.error("Error completing exam:", error);
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to complete exam' 
        });
    }
});

module.exports = router;