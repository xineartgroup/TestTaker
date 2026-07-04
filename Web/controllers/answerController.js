const express = require("express");
const { makeApiRequest } = require("./_baseController");
const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.isLoggedIn) {
        return res.status(401).json({ 
            issuccess: false, 
            message: "Not authenticated" 
        });
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

module.exports = router;