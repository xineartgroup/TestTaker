const path = require('path');
const jwt = require('jsonwebtoken');
const ac = require('./ac');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // Load environment variables from .env file

const generateToken = (userId, userRole) => {
    return jwt.sign({ 
        Id: userId, 
        Role: userRole
    }, process.env.SESSION_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
};

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token || 
                  req.headers.authorization?.replace('Bearer ', '') || 
                  req.body.token;
    
    if (!token) {
        return res.status(401).json({ 
            issuccess: false, 
            message: "No token provided" 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.SESSION_SECRET);
            
        req.user = {
            Id: decoded.Id,
            Role: decoded.Role
        };
        
        next();
    } catch (error) {
        return res.status(403).json({ 
            issuccess: false, 
            message: "Invalid token", 
            token: '' 
        });
    }
};

const checkPermission = (actions, resource, user) => {
    // Check if user exists
    if (!user || !user.Role) {
        return { issuccess: false, message: 'User not authenticated or missing role.' };
    }

    let granted = false;

    for (const action of actions) {
        const permission = ac.can(user.Role)[action](resource);
        if (permission.granted) {
            granted = true;
            break;
        }
    }

    console.log("Permission granted:", granted);

    if (!granted) {
        return { issuccess: false, message: 'Insufficient permissions.' };
    }

    console.log("Permission Granted!!!");
    
    return { issuccess: true, message: '' };
};

// Check if user has specific role
const checkRole = (user, roles) => {
    if (!user || !user.Role) {
        return { issuccess: false, message: 'User not authenticated.' };
    }
    
    if (!Array.isArray(roles)) {
        roles = [roles];
    }
    
    if (roles.includes(user.Role)) {
        return { issuccess: true, message: '' };
    }
    
    return { issuccess: false, message: 'Insufficient role permissions.' };
};

// Helper function to get user ID from token
const getUserIdFromToken = (req) => {
    return req.user ? req.user.Id : null;
};

// Helper function to check if user is admin
const isAdmin = (user) => {
    return user && user.Role === 'Administrator';
};

// Helper function to check if user is manager or above
const isManagerOrAbove = (user) => {
    return user && (user.Role === 'Administrator' || user.Role === 'Manager');
};

module.exports = { 
    generateToken, 
    authenticateToken, 
    checkPermission,
    checkRole,
    getUserIdFromToken,
    isAdmin,
    isManagerOrAbove
};