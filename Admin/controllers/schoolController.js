const { makeApiRequest } = require("./_baseController");
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));

// Fetch schools with pagination and filtering
const fetchSchools = async (skip, limit, req, searchValue, requiresInvite, sortName, sortOrder) => {
    let url = `/api/schools?skip=${skip}&limit=${limit}&searchValue=${searchValue || '*'}`;
    if (requiresInvite !== undefined && requiresInvite !== '') {
        url += `&requiresInvite=${requiresInvite}`;
    }
    if (sortName) url += `&sortName=${sortName}`;
    if (sortOrder) url += `&sortOrder=${sortOrder}`;
    return await makeApiRequest('GET', url, req);
};

// Index page - list all schools
const schoolIndex = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let searchValue = req.query.searchValue != null && req.query.searchValue != '' ? encodeURIComponent(req.query.searchValue) : "*";
        let requiresInvite = req.query.requiresInvite;
        let sortName = req.query.sortName != null && req.query.sortName != '' ? req.query.sortName : "Name";
        let sortOrder = req.query.sortOrder != null && req.query.sortOrder != '' ? req.query.sortOrder : "asc";

        const result = await fetchSchools(skip, limit, req, searchValue, requiresInvite, sortName, sortOrder);
        
        if (result.issuccess) {
            const schools = result.schools;

            searchValue = decodeURIComponent(searchValue);
            if (searchValue == "*") searchValue = "";

            return res.render('schools/index', {
                title: 'School List',
                schools,
                currentPage: page,
                totalPages: Math.ceil(result.count / limit),
                searchValue,
                requiresInvite,
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

// School detail page
const schoolDetailGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('GET', `/api/schools/${req.params.id}`, req);

        if (result.issuccess) {
            // Get subjects for this school
            const subjectsResult = await makeApiRequest('GET', `/api/schools/${req.params.id}/subjects`, req);
            const subjects = subjectsResult.issuccess ? subjectsResult.subjects : [];
            
            return res.render('schools/detail', { 
                title: 'School Detail', 
                config, 
                school: result.school,
                subjects: subjects
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Create school page
const schoolCreateGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }
        
        return res.render('schools/create', { 
            title: 'New School',
            error: null
        });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Create school POST
const schoolCreatePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const school = req.body;
        const result = await makeApiRequest('POST', '/api/schools/create', req, school);
        
        if (result.issuccess) {
            return res.redirect('/schools');
        } else {
            return res.render('schools/create', { 
                title: 'New School',
                error: result.message
            });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Update school page
const schoolUpdateGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('GET', `/api/schools/${req.params.id}`, req);
        
        if (result.issuccess) {
            return res.render('schools/update', { 
                title: 'Update School', 
                school: result.school
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        console.error('Error in schoolUpdateGet:', error);
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Update school POST
const schoolUpdatePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const school = req.body;
        const result = await makeApiRequest('POST', `/api/schools/update/${req.params.id}`, req, school);
        
        if (result.issuccess) {
            return res.redirect('/schools');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Delete school page
const schoolDeleteGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('GET', `/api/schools/${req.params.id}`, req);
        
        if (result.issuccess) {
            return res.render('schools/delete', { 
                title: 'Delete School', 
                school: result.school 
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Delete school POST
const schoolDeletePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('POST', `/api/schools/delete/${req.params.id}`, req);
        
        if (result.issuccess) {
            return res.redirect('/schools');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Get users for a school
const schoolUsersGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const schoolResult = await makeApiRequest('GET', `/api/schools/${req.params.id}`, req);
        
        if (!schoolResult.issuccess) {
            return res.render('error', { title: 'Error', detail: schoolResult.message });
        }

        // Get users for this school
        // Note: You might need to add an endpoint to get users by school
        // For now, we'll get all users and filter
        const usersResult = await makeApiRequest('GET', `/api/users?limit=1000`, req);
        const schoolUsers = usersResult.issuccess ? usersResult.users.filter(user => 
            user.Schools && user.Schools.some(s => s.Id === parseInt(req.params.id))
        ) : [];

        return res.render('schools/users', { 
            title: 'School Users', 
            school: schoolResult.school,
            users: schoolUsers
        });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Routes
const router = require('express').Router();

router.get('', schoolIndex);
router.get('/detail/:id', schoolDetailGet);
router.get('/create', schoolCreateGet);
router.post('/create', schoolCreatePost);
router.get('/update/:id', schoolUpdateGet);
router.post('/update/:id', schoolUpdatePost);
router.get('/delete/:id', schoolDeleteGet);
router.post('/delete/:id', schoolDeletePost);
router.get('/:id/users', schoolUsersGet);

module.exports = router;