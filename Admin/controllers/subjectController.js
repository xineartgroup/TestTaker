const express = require("express");
const { makeApiRequest } = require("./_baseController");
const router = express.Router();

const fetchSubjects = async (skip, limit, req, searchValue, sortName, sortOrder) => {
    return await makeApiRequest('GET', `/api/subjects?skip=${skip}&limit=${limit}&searchValue=${searchValue}&sortName=${sortName}&sortOrder=${sortOrder}`, req);
};

// Index page - list all subjects
const subjectIndex = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
        
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let searchValue = req.query.searchValue ? encodeURIComponent(req.query.searchValue) : "*";
        let sortName = req.query.sortName || "Id";
        let sortOrder = req.query.sortOrder || "desc";

        const result = await fetchSubjects(skip, limit, req, searchValue, sortName, sortOrder);
        
        if (result.issuccess) {
            searchValue = decodeURIComponent(searchValue);
            if (searchValue === "*") searchValue = "";

            return res.render('subjects/index', {
                title: 'Subject List',
                subjects: result.subjects,
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
};

// Create subject page
const subjectCreateGet = async (req, res) => {
    if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
    return res.render('subjects/create', { title: 'New Subject' });
};

// Create subject POST
const subjectCreatePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');

        const result = await makeApiRequest('POST', '/api/subjects/create', req, req.body);
        if (result.issuccess) {
            return res.redirect('/subjects');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Update subject page
const subjectUpdateGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');

        const result = await makeApiRequest('GET', `/api/subjects/${req.params.id}`, req);
        if (result.issuccess) {
            return res.render('subjects/update', { title: 'Update Subject', subject: result.subject });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Update subject POST
const subjectUpdatePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');

        const result = await makeApiRequest('POST', `/api/subjects/update/${req.params.id}`, req, req.body);
        if (result.issuccess) {
            return res.redirect('/subjects');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Delete subject page
const subjectDeleteGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');

        const result = await makeApiRequest('GET', `/api/subjects/${req.params.id}`, req);
        if (result.issuccess) {
            return res.render('subjects/delete', { title: 'Delete Subject', subject: result.subject });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Delete subject POST
const subjectDeletePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');

        const result = await makeApiRequest('POST', `/api/subjects/delete/${req.params.id}`, req);
        if (result.issuccess) {
            return res.redirect('/subjects');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// View Routes
router.get('', subjectIndex);
router.get('/create', subjectCreateGet);
router.post('/create', subjectCreatePost);
router.get('/update/:id', subjectUpdateGet);
router.post('/update/:id', subjectUpdatePost);
router.get('/delete/:id', subjectDeleteGet);
router.post('/delete/:id', subjectDeletePost);

module.exports = router;