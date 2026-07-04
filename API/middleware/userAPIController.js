const express = require("express");
const getPool = require('../middleware/sqlconnection');
const bcrypt = require('bcryptjs');
const { generateToken, authenticateToken, checkPermission } = require("../middleware/_baseAPIController");

const router = express.Router();

// Get list of users
router.get("/", authenticateToken, async (req, res) => {
    try {
        const { skip, limit, searchValue, sortName: rawSortName, sortOrder } = req.query;
        const pool = await getPool();
        const request = pool.request();

        // Check permission - adjust based on your needs
        const permissionResult = checkPermission(['readAny'], 'users', req.user);
        
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }
        
        let query = "SELECT * FROM Users";
        let whereConditions = [];

        if (searchValue && searchValue !== "*") {
            const searchCondition = [
                "UserName LIKE '%' + @searchValue + '%'",
                "FirstName LIKE '%' + @searchValue + '%'",
                "LastName LIKE '%' + @searchValue + '%'",
                "Email LIKE '%' + @searchValue + '%'",
                "PhoneNumber LIKE '%' + @searchValue + '%'"
            ].join(" OR ");
            
            whereConditions.push(`(${searchCondition})`);
            request.input('searchValue', searchValue);
        }

        if (whereConditions.length > 0) {
            query += " WHERE " + whereConditions.join(" AND ");
        }

        // Sorting
        const sortName = rawSortName === "Name" ? "CONCAT(FirstName, ' ', LastName)" : "Id";
        const validatedSortOrder = sortOrder === "DESC" ? "DESC" : "ASC";
        query += ` ORDER BY ${sortName} ${validatedSortOrder}`;

        let usersResult = await request.query(query);
        const count = usersResult.recordset.length;

        if (skip && limit) {
            query += " OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY";
            request.input('skip', parseInt(skip));
            request.input('limit', parseInt(limit));
        }

        usersResult = await request.query(query);
        const users = usersResult.recordset;

        // Remove passwords from response
        users.forEach(user => {
            delete user.Password;
        });

        return res.json({ issuccess: true, message: "", count, users });

    } catch (err) {
        return res.json({
            issuccess: false, 
            message: "Server Error: " + err.message, 
            count: 0, 
            users: [] 
        });
    }
});

// Get a single user by ID
router.get("/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        const resultUser = await pool.request()
            .input("id", id)
            .query("SELECT * FROM Users WHERE id = @id");

        if (resultUser.recordset.length === 0) {
            throw new Error("User not found");
        }

        const permissionResult = checkPermission(['readOwn', 'readAny'], 'users', req.user);
        
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        const user = resultUser.recordset[0];
        delete user.Password; // Remove password from response

        return res.json({ 
            issuccess: true, 
            message: "", 
            count: 1,
            user
        });

    } catch (err) {
        return res.json({ 
            issuccess: false, 
            message: "Server Error: " + err.message, 
            count: 0,
            user: null
        });
    }
});

// Create a new user
router.post("/create", authenticateToken, async (req, res) => {
    try {
        const { UserName, Password, FirstName, LastName, Email, Role, PhoneNumber, IsActive } = req.body;
        let Picture = req.file ? req.file.filename : '';

        const permissionResult = checkPermission(['createOwn', 'createAny'], 'users', req.user);
        
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        // Check if username already exists
        const pool = await getPool();
        const existingUser = await pool.request()
            .input('UserName', UserName)
            .query("SELECT * FROM Users WHERE UserName = @UserName");
        
        if (existingUser.recordset.length > 0) {
            throw new Error("Username already exists");
        }

        const hashedPassword = await bcrypt.hash(Password, 10);

        const result = await pool.request()
            .input('UserName', UserName)
            .input('Password', hashedPassword)
            .input('FirstName', FirstName)
            .input('LastName', LastName)
            .input('Email', Email)
            .input('Role', Role)
            .input('PhoneNumber', PhoneNumber)
            .input('Picture', Picture)
            .input('Token', '')
            .input('IsActive', IsActive !== undefined ? IsActive : true)
            .input('StartDate', new Date())
            .query(`INSERT INTO Users 
                (UserName, Password, FirstName, LastName, Email, Role, PhoneNumber, Picture, Token, IsActive, StartDate) 
                OUTPUT INSERTED.ID VALUES 
                (@UserName, @Password, @FirstName, @LastName, @Email, @Role, @PhoneNumber, @Picture, @Token, @IsActive, @StartDate)`);
        
        const Id = result.recordset.length > 0 ? result.recordset[0].ID : 0;
        const createdUser = { 
            Id, 
            UserName, 
            FirstName, 
            LastName, 
            Email, 
            Role, 
            PhoneNumber, 
            Picture, 
            IsActive: IsActive !== undefined ? IsActive : true,
            StartDate: new Date()
        };
        
        return res.json({ issuccess: true, message: "", count: 1, user: createdUser });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

// Update an existing user
router.post("/update/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();

        const resultUser = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Users WHERE id = @id");

        if (resultUser.recordset.length === 0) {
            throw new Error("User not found");
        }

        let user = resultUser.recordset[0];
        const { FirstName, LastName, Email, PhoneNumber, IsActive, Role } = req.body;

        const permissionResult = checkPermission(['updateOwn', 'updateAny'], 'users', req.user);
        
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        let Picture = req.body.Picture != null ? req.body.Picture : user.Picture;
        let token = req.body.Token != null ? req.body.Token : user.Token;
        let isActive = req.body.IsActive != null ? req.body.IsActive : user.IsActive;
        let role = req.body.Role != null ? req.body.Role : user.Role;

        user.FirstName = FirstName || user.FirstName;
        user.LastName = LastName || user.LastName;
        user.Email = Email || user.Email;
        user.PhoneNumber = PhoneNumber || user.PhoneNumber;
        user.IsActive = isActive;
        user.Role = role;

        await pool.request()
            .input('FirstName', user.FirstName)
            .input('LastName', user.LastName)
            .input('Email', user.Email)
            .input('PhoneNumber', user.PhoneNumber)
            .input('IsActive', user.IsActive)
            .input('Role', user.Role)
            .input('Picture', Picture)
            .input('Token', token)
            .input('id', user.Id)
            .query(`UPDATE Users SET 
                FirstName = @FirstName, 
                LastName = @LastName, 
                Email = @Email, 
                PhoneNumber = @PhoneNumber, 
                IsActive = @IsActive, 
                Role = @Role, 
                Picture = @Picture, 
                Token = @Token 
            WHERE ID = @id`);

        delete user.Password;
        return res.json({ issuccess: true, message: "", count: 1, user });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

// Delete a user
router.post("/delete/:id", authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();

        const resultUser = await pool.request()
            .input("id", req.params.id)
            .query("SELECT * FROM Users WHERE id = @id");

        if (resultUser.recordset.length === 0) {
            throw new Error("User not found");
        }

        const permissionResult = checkPermission(['deleteOwn', 'deleteAny'], 'users', req.user);
        
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        await pool.request()
            .input("id", req.params.id)
            .query("DELETE FROM Users WHERE id = @id");
        
        return res.json({ issuccess: true, message: "", count: 0, user: null });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

// Change password
router.post('/changepassword/:id', authenticateToken, async (req, res) => {
    try {
        const { PasswordOld, PasswordNew, PasswordConfirm } = req.body;

        if (PasswordNew !== PasswordConfirm) {
            throw new Error("New Password and confirmation don't match!!!");
        }

        if (PasswordOld === PasswordNew) {
            throw new Error("Old Password and New Password are the same!!!");
        }

        const { id } = req.params;
        
        const pool = await getPool();
        const result = await pool.request()
            .input('Id', id)
            .query('SELECT * FROM Users WHERE Id = @Id');

        const user = result.recordset.length > 0 ? result.recordset[0] : null;

        if (!user) {
            throw new Error("User not found!!!");
        }

        const permissionResult = checkPermission(['updateOwn', 'updateAny'], 'users', req.user);
        
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        const isMatch = await bcrypt.compare(PasswordOld, user.Password);
        if (!isMatch) {
            throw new Error("Password mismatch!!!");
        }

        const hashedPassword = await bcrypt.hash(PasswordNew, 10);

        await pool.request()
            .input('Password', hashedPassword)
            .input('id', id)
            .query(`UPDATE Users SET Password = @Password WHERE ID = @id`);

        delete user.Password;
        return res.json({ issuccess: true, message: "Password changed successfully", count: 1, user });

    } catch (err) {
        return res.json({ issuccess: false, message: "Server Error: " + err.message, count: 0, user: null });
    }
});

// Get users by role
router.get('/role/:role', authenticateToken, async (req, res) => {
    try {
        const pool = await getPool();

        const permissionResult = checkPermission(['readAny'], 'users', req.user);
        
        if (!permissionResult.issuccess) {
            throw new Error(permissionResult.message);
        }

        const resultUsers = await pool.request()
            .input("role", req.params.role)
            .query("SELECT * FROM Users WHERE Role = @role");

        const users = resultUsers.recordset;
        users.forEach(user => delete user.Password);

        return res.json({ 
            issuccess: true, 
            message: "", 
            count: users.length, 
            users 
        });

    } catch (err) {
        console.error(err);
        return res.json({ issuccess: false, message: err.message, count: 0, users: [] });
    }
});

module.exports = router;