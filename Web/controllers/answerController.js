const express = require("express");
const { makeApiRequest } = require("./_baseController");
const router = express.Router();

// Middleware to check authentication status
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.isLoggedIn) {
        // Check if the request expects JSON (API call)
        const isApiRequest = req.xhr || 
                            req.headers.accept?.includes('application/json') || 
                            req.path.startsWith('/api/');
        
        if (isApiRequest) {
            return res.status(401).json({ 
                issuccess: false, 
                message: "Not authenticated" 
            });
        }
        
        // For page requests, redirect to login
        return res.redirect('/login');
    }
    
    req.user = {
        Id: req.session.userId,
        Role: req.session.userRole || 'User'
    };
    
    next();
};

// View all answers for a user (for review)
router.get('/my-answers', requireAuth, async (req, res) => {
    try {
        const userId = req.user.Id;
        const answersResult = await makeApiRequest('GET', `/api/answers?userId=${userId}`, req);
        
        if (!answersResult.issuccess) {
            return res.render('error', { 
                title: 'Error', 
                detail: answersResult.message 
            });
        }
        
        return res.render('answers/my-answers', {
            title: 'My Answers',
            answers: answersResult.answers || []
        });
        
    } catch (error) {
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to load answers' 
        });
    }
});

// View answers for a specific exam
router.get('/exam/:examId', requireAuth, async (req, res) => {
    try {
        const { examId } = req.params;
        
        const examResult = await makeApiRequest('GET', `/api/exams/${examId}`, req);
        if (!examResult.issuccess) {
            return res.render('error', { 
                title: 'Error', 
                detail: examResult.message 
            });
        }
        
        const answersResult = await makeApiRequest('GET', `/api/answers/exam/${examId}`, req);
        
        return res.render('answers/exam-answers', {
            title: `Answers for ${examResult.exam.Name}`,
            exam: examResult.exam,
            answers: answersResult.issuccess ? answersResult.answers : []
        });
        
    } catch (error) {
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to load exam answers' 
        });
    }
});

// Grade an answer (teacher/admin view)
router.get('/grade/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const answerResult = await makeApiRequest('GET', `/api/answers/${id}`, req);
        if (!answerResult.issuccess) {
            return res.render('error', { 
                title: 'Error', 
                detail: answerResult.message 
            });
        }
        
        return res.render('answers/grade', {
            title: 'Grade Answer',
            answer: answerResult.answer
        });
        
    } catch (error) {
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to load answer' 
        });
    }
});

// Submit grade
router.post('/grade/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { pointsEarned } = req.body;
        
        const result = await makeApiRequest('POST', `/api/answers/grade/${id}`, req, {
            pointsEarned: parseFloat(pointsEarned) || 0
        });
        
        if (!result.issuccess) {
            return res.render('error', { 
                title: 'Error', 
                detail: result.message 
            });
        }
        
        return res.redirect('/answers/my-answers');
        
    } catch (error) {
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to grade answer' 
        });
    }
});

// Review completed exam with all answers
router.get('/review/:examId', requireAuth, async (req, res) => {
    try {
        const { examId } = req.params;
        
        const examResult = await makeApiRequest('GET', `/api/exams/${examId}`, req);
        if (!examResult.issuccess) {
            return res.render('error', { 
                title: 'Error', 
                detail: examResult.message 
            });
        }
        
        const answersResult = await makeApiRequest('GET', `/api/answers/exam/${examId}`, req);
        const questionsResult = await makeApiRequest('GET', `/api/questions?examId=${examId}`, req);
        
        // Combine questions with answers
        const questionsWithAnswers = (questionsResult.questions || []).map(q => {
            const answer = (answersResult.answers || []).find(a => a.QuestionId === q.Id);
            return {
                ...q,
                answer: answer || null
            };
        });
        
        return res.render('answers/review', {
            title: `Review: ${examResult.exam.Name}`,
            exam: examResult.exam,
            questions: questionsWithAnswers
        });
        
    } catch (error) {
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to review exam' 
        });
    }
});

router.get('/my-scores', requireAuth, async (req, res) => {
    try {
        const userId = req.user.Id;
        
        // Fetch scores from the answers API
        const scoresResult = await makeApiRequest('GET', `/api/answers/scores`, req);
        const scores = scoresResult.issuccess ? scoresResult.scores : [];
        
        // Calculate statistics
        let totalQuestions = 0;
        let totalScore = 0;
        let bestScore = 0;
        
        scores.forEach(score => {
            totalQuestions += score.TotalQuestions || 0;
            totalScore += score.Percentage || 0;
            if (score.Percentage > bestScore) bestScore = score.Percentage;
        });
        
        const averageScore = scores.length > 0 ? Math.round(totalScore / scores.length) : 0;
        
        return res.render('answers/my-scores', {
            title: 'My Scores',
            scores: scores,
            averageScore: averageScore,
            bestScore: bestScore,
            totalQuestions: totalQuestions,
            totalExams: scores.length
        });
        
    } catch (error) {
        console.error("Error loading scores:", error);
        return res.render('error', { 
            title: 'Error', 
            detail: error.message || 'Failed to load scores' 
        });
    }
});

module.exports = router;