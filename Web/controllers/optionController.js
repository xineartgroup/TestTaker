const express = require("express");
const { makeApiRequest } = require("./_baseController");
const router = express.Router();

const fetchOptions = async (skip, limit, req, searchValue, sortName, sortOrder, questionId) => {
    let url = `/api/options?skip=${skip}&limit=${limit}&searchValue=${searchValue}&sortName=${sortName}&sortOrder=${sortOrder}`;
    if (questionId) url += `&questionId=${questionId}`;
    return await makeApiRequest('GET', url, req);
};

router.get("", async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');

        const page = parseInt(req.query.page) || 1;
        const limit = 20; // Options readouts generally benefit from higher defaults
        const skip = (page - 1) * limit;
        const questionId = req.query.questionId || "";

        let searchValue = req.query.searchValue ? encodeURIComponent(req.query.searchValue) : "*";
        let sortName = req.query.sortName || "Id";
        let sortOrder = req.query.sortOrder || "asc";

        const result = await fetchOptions(skip, limit, req, searchValue, sortName, sortOrder, questionId);

        if (result.issuccess) {
            searchValue = decodeURIComponent(searchValue);
            if (searchValue === "*") searchValue = "";

            return res.render('options/index', {
                title: 'Option List',
                options: result.options,
                currentPage: page,
                totalPages: Math.ceil(result.count / limit),
                searchValue,
                sortName,
                sortOrder,
                questionId
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
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
        return res.render('options/create', { 
            title: 'New Option', 
            selectedQuestionId: req.query.questionId || "" 
        });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.post('/create', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
        
        // Treat HTML checkbox empty value scenario for bit datatype parsing
        req.body.IsCorrect = req.body.IsCorrect === 'on' || req.body.IsCorrect === true;

        const result = await makeApiRequest('POST', '/api/options/create', req, req.body);
        if (result.issuccess) return res.redirect(`/options?questionId=${req.body.QuestionId || ''}`);
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.get('/update/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
        const result = await makeApiRequest('GET', `/api/options/${req.params.id}`, req);
        if (result.issuccess) return res.render('options/update', { title: 'Update Option', option: result.option });
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.post('/update/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
        
        req.body.IsCorrect = req.body.IsCorrect === 'on' || req.body.IsCorrect === true;

        const result = await makeApiRequest('POST', `/api/options/update/${req.params.id}`, req, req.body);
        if (result.issuccess) return res.redirect(`/options?questionId=${result.option.QuestionId || ''}`);
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.get('/delete/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
        const result = await makeApiRequest('GET', `/api/options/${req.params.id}`, req);
        if (result.issuccess) return res.render('options/delete', { title: 'Delete Option', option: result.option });
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

router.post('/delete/:id', async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
        
        const optionResult = await makeApiRequest('GET', `/api/options/${req.params.id}`, req);
        const questionId = optionResult.issuccess ? optionResult.option.QuestionId : "";

        const result = await makeApiRequest('POST', `/api/options/delete/${req.params.id}`, req);
        if (result.issuccess) return res.redirect(`/options?questionId=${questionId}`);
        return res.render('error', { title: 'Error', detail: result.message });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
});

module.exports = router;