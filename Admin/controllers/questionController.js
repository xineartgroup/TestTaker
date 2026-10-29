const express = require("express");
const { makeApiRequest } = require("./_baseController");
const router = express.Router();

const fetchQuestions = async (skip, limit, req, searchValue, sortName, sortOrder, examId) => {
    let url = `/api/questions?skip=${skip}&limit=${limit}&searchValue=${searchValue}&sortName=${sortName}&sortOrder=${sortOrder}`;
    if (examId) url += `&examId=${examId}`;
    return await makeApiRequest('GET', url, req);
};

router.get("", async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/Admin/login');

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const examId = req.query.examId || "";

        let searchValue = req.query.searchValue ? encodeURIComponent(req.query.searchValue) : "*";
        let sortName = req.query.sortName || "Id";
        let sortOrder = req.query.sortOrder || "desc";

        const result = await fetchQuestions(skip, limit, req, searchValue, sortName, sortOrder, examId);

        if (result.issuccess) {
            searchValue = decodeURIComponent(searchValue);
            if (searchValue === "*") searchValue = "";

            // Get exam name if examId is provided
            let examName = null;
            if (examId) {
                const examResult = await makeApiRequest('GET', `/api/exams/${examId}`, req);
                if (examResult.issuccess) {
                    examName = examResult.exam.Name;
                }
            }

            return res.render('questions/index', {
                title: 'Question List',
                questions: result.questions,
                currentPage: page,
                totalPages: Math.ceil(result.count / limit),
                searchValue,
                sortName,
                sortOrder,
                examId,
                examName
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.get('/create', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/Admin/login');
        const examsResult = await makeApiRequest('GET', '/api/exams?skip=0&limit=1000', req);
        
        return res.render('questions/create', { 
            title: 'New Question', 
            exams: examsResult.issuccess ? examsResult.exams : [],
            selectedExamId: req.query.examId || "",
            error: null
        });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.post('/create', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/Admin/login');
        const result = await makeApiRequest('POST', '/api/questions/create', req, req.body);
        if (result.issuccess) return res.redirect(`/questions?examId=${req.body.ExamId || ''}`);
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.get('/update/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/Admin/login');
        
        // Fetch the question
        const questionResult = await makeApiRequest('GET', `/api/questions/${req.params.id}`, req);
        
        // Fetch all exams for the dropdown
        const examsResult = await makeApiRequest('GET', '/api/exams?skip=0&limit=1000', req);
        
        // Fetch options for this question
        const optionsResult = await makeApiRequest('GET', `/api/options?questionId=${req.params.id}`, req);

        if (questionResult.issuccess) {
            return res.render('questions/update', { 
                title: 'Update Question', 
                question: questionResult.question,
                exams: examsResult.issuccess ? examsResult.exams : [],
                options: optionsResult.issuccess ? optionsResult.options : [],
                error: null
            });
        }
        return res.render('error', { title: 'Error', detail: questionResult.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.post('/update/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/Admin/login');
        const result = await makeApiRequest('POST', `/api/questions/update/${req.params.id}`, req, req.body);
        if (result.issuccess) return res.redirect(`/questions?examId=${result.question.ExamId || ''}`);
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.get('/delete/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/Admin/login');
        
        // Fetch the question
        const questionResult = await makeApiRequest('GET', `/api/questions/${req.params.id}`, req);
        
        // Fetch options for this question to show count
        const optionsResult = await makeApiRequest('GET', `/api/options?questionId=${req.params.id}`, req);
        
        // Fetch exam name
        let examName = null;
        if (questionResult.issuccess && questionResult.question.ExamId) {
            const examResult = await makeApiRequest('GET', `/api/exams/${questionResult.question.ExamId}`, req);
            if (examResult.issuccess) {
                examName = examResult.exam.Name;
            }
        }

        if (questionResult.issuccess) {
            return res.render('questions/delete', { 
                title: 'Delete Question', 
                question: questionResult.question,
                options: optionsResult.issuccess ? optionsResult.options : [],
                examName: examName
            });
        }
        return res.render('error', { title: 'Error', detail: questionResult.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.post('/delete/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/Admin/login');
        
        // Fetch to identify context redirect path before executing delete
        const questionResult = await makeApiRequest('GET', `/api/questions/${req.params.id}`, req);
        const examId = questionResult.issuccess ? questionResult.question.ExamId : "";

        const result = await makeApiRequest('POST', `/api/questions/delete/${req.params.id}`, req);
        if (result.issuccess) return res.redirect(`/questions?examId=${examId}`);
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

module.exports = router;