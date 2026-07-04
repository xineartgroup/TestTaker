const express = require("express");
const { makeApiRequest } = require("./_baseController");
const upload = require('./upload');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));
const router = express.Router();

// Fetch users with pagination and filtering
const fetchUsers = async (skip, limit, req, session, searchValue, sortName, sortOrder) => {
    return await makeApiRequest('GET', `/api/users?skip=${skip}&limit=${limit}&searchValue=${searchValue}&sortName=${sortName}&sortOrder=${sortOrder}`, req);
};

// Index page - list all users
const userIndex = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let searchValue = req.query.searchValue != null && req.query.searchValue != '' ? encodeURIComponent(req.query.searchValue) : "*";
        let sortName = req.query.sortName != null && req.query.sortName != '' ? req.query.sortName : "Id";
        let sortOrder = req.query.sortOrder != null && req.query.sortOrder != '' ? req.query.sortOrder : "desc";

        const result = await fetchUsers(skip, limit, req, req.session, searchValue, sortName, sortOrder);
        
        if (result.issuccess) {
            const users = result.users;

            searchValue = decodeURIComponent(searchValue);
            if (searchValue == "*") searchValue = "";

            return res.render('users/index', {
                title: 'User List',
                users,
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

// User detail page
const userDetailGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('GET', `/api/users/${req.params.id}`, req);

        if (result.issuccess) {
            return res.render('users/detail', { 
                title: 'User Detail', 
                config, 
                user: result.user 
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// User detail POST (for updates)
const userDetailPost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('POST', `/api/users/${req.params.id}`, req, req.body);

        if (result.issuccess) {
            return res.redirect('/users');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Create user page
const userCreateGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }
        
        return res.render('users/create', { title: 'New User' });
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Create user POST
const userCreatePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        let user = req.body;

        const result = await makeApiRequest('POST', '/api/users/create', req, user);
        
        if (result.issuccess) {
            return res.redirect('/users');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Update user page
const userUpdateGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('GET', `/api/users/${req.params.id}`, req);
        
        if (result.issuccess) {
            return res.render('users/update', { 
                title: 'Update User', 
                user: result.user 
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Update user POST
const userUpdatePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        let user = req.body;
        user.Picture = req.file ? req.file.filename : user.Picture;
        
        const result = await makeApiRequest('POST', `/api/users/update/${req.params.id}`, req, user);
        
        if (result.issuccess) {
            return res.redirect('/');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Delete user page
const userDeleteGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('GET', `/api/users/${req.params.id}`, req);
        
        if (result.issuccess) {
            return res.render('users/delete', { 
                title: 'Delete User', 
                user: result.user 
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Delete user POST
const userDeletePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('POST', `/api/users/delete/${req.params.id}`, req);
        
        if (result.issuccess) {
            return res.redirect('/users');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Change password page
const changePasswordGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        res.render('users/changepassword', { title: 'Change Password' });
    } catch (error) {
        return res.render("users/changepassword", { 
            title: 'Change Password', 
            error: "Login error: " + (error.message || error) 
        });
    }
};

// Change password POST
const changePasswordPost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('POST', `/api/users/changepassword/${req.session.user.Id}`, req, req.body);

        if (result.issuccess) {
            res.redirect("/");
        } else {
            console.log("error: ", result.message);
            return res.render("users/changepassword", { 
                title: 'Change Password', 
                error: result.message 
            });
        }
    } catch (error) {
        return res.render("users/changepassword", { 
            title: 'Change Password', 
            error: "Login error: " + (error.message || error) 
        });
    }
};

// Profile page - view current user's profile
const userProfileGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('GET', `/api/users/${req.session.user.Id}`, req);
        
        if (result.issuccess) {
            return res.render('users/profile', { 
                title: 'My Profile', 
                user: result.user 
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Update profile page
const userProfileUpdateGet = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        const result = await makeApiRequest('GET', `/api/users/${req.session.user.Id}`, req);
        
        if (result.issuccess) {
            return res.render('users/profile_update', { 
                title: 'Update Profile', 
                user: result.user 
            });
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Update profile POST
const userProfileUpdatePost = async (req, res) => {
    try {
        if (!req.session || !req.session.isLoggedIn) {
            return res.redirect('/login');
        }

        let user = req.body;
        user.Picture = req.file ? req.file.filename : user.Picture;
        
        const result = await makeApiRequest('POST', `/api/users/update/${req.session.user.Id}`, req, user);
        
        if (result.issuccess) {
            // Update session user data
            req.session.user = result.user;
            return res.redirect('/users/profile');
        } else {
            return res.render('error', { title: 'Error', detail: result.message });
        }
    } catch (error) {
        return res.render('error', { title: 'Error', detail: error.message || error });
    }
};

// Routes
router.get('', userIndex);
router.get('/detail/:id', userDetailGet);
router.post('/detail/:id', userDetailPost);
router.get('/create', userCreateGet);
router.post('/create', upload.single("Picture"), userCreatePost);
router.get('/update/:id', userUpdateGet);
router.post('/update/:id', upload.single("Picture"), userUpdatePost);
router.get('/delete/:id', userDeleteGet);
router.post('/delete/:id', userDeletePost);
router.get("/changepassword", changePasswordGet);
router.post("/changepassword", changePasswordPost);

// Profile routes
router.get('/profile', userProfileGet);
router.get('/profile/update', userProfileUpdateGet);
router.post('/profile/update', upload.single("Picture"), userProfileUpdatePost);

module.exports = router;