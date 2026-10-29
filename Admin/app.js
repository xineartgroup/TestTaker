const path = require('path');
const https = require('https');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const flash = require("connect-flash");
const multer = require('multer');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { hostname, port, apihost } = require(path.join(__dirname, 'config'));

const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const examController = require('./controllers/examController');
const subjectController = require('./controllers/subjectController');
const questionController = require('./controllers/questionController');
const optionController = require('./controllers/optionController');
const answerController = require('./controllers/answerController');
const schoolController = require('./controllers/schoolController');

const app = express();
app.set('trust proxy', 1); 

app.set('view engine', 'ejs');
// This ensures it looks in Admin/views, NOT the root views folder
app.set('views', path.join(__dirname, 'views'));

if (process.env.NODE_ENV === 'production') {
    const storeMSSQL = require('connect-mssql-v2')(session);
    
    const dbConfig = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_HOST,
        database: process.env.DB_NAME,
        options: {
            encrypt: true,
            trustServerCertificate: false,
            enableArithAbort: true
        },
        port: 1433
    };

    app.use(session({
        secret: process.env.SESSION_SECRET_ADMIN,
        resave: false,
        saveUninitialized: false,
        name: 'admin.sid', // Unique cookie name for Admin
        store: new storeMSSQL(dbConfig),
        cookie: {
            httpOnly: true,
            maxAge: 3600000,
            sameSite: 'none',
            secure: true 
        }
    }));
}
else {
    app.use(session({
        // Added fallback so it doesn't crash if the env var is missing in dev
        secret: process.env.SESSION_SECRET_ADMIN || 'admin-dev-secret-key-123', 
        resave: false,
        saveUninitialized: false,
        name: 'admin.sid', // Unique cookie name for Admin
        cookie: {
            httpOnly: true,
            maxAge: 3600000,
            sameSite: 'none',
            secure: true 
        }
    }));
}

app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(flash());

app.use((req, res, next) => {
    res.locals.message = req.flash("message");
    res.locals.error = req.flash("error");
    res.locals.session = req.session;
    next();
});

app.use((req, res, next) => {
    if (req.path !== '/favicon.ico' && req.path.endsWith('.png') === false && req.path.endsWith('.json') === false) {
        console.log('Admin Host: ', req.hostname + ' ' + req.path + ' ' + req.method);
    }
    next();
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, uniqueSuffix + fileExtension);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    console.log('File uploaded successfully:', req.file);
    res.status(200).json({
        message: 'File uploaded successfully!',
        fileName: req.file.filename,
        filePath: req.file.path
    });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        console.error("Multer error:", err.message);
        return res.status(400).send(`Multer Error: ${err.message}`);
    } else if (err) {
        console.error("General error:", err.message);
        return res.status(500).send(`Server Error: ${err.message}`);
    }
    next();
});

app.get('/', async (req, res) => {
    // FIXED: Lowercase '/admin/login' to match the root app's mount point
    if (!req.session || !req.session.isLoggedIn) return res.redirect('/admin/login');
    
    try {
        const user = req.session.user;
        if (!user) {
            return res.render('error', { title: 'Error', detail: "No user found in session." });
        }

        let rawSearch = req.query.searchValue || "";
        const sql = require('mssql'); 
        let exams = [];
        
        try {
            let pool = await sql.connect({
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                server: process.env.DB_HOST,
                database: process.env.DB_NAME,
                options: {
                    encrypt: true,
                    trustServerCertificate: true,
                    enableArithAbort: true
                },
                port: 1433
            });
            
            let request = pool.request();
            let queryStr = 'SELECT * FROM Exams';

            if (rawSearch !== '') {
                request.input('searchPattern', sql.VarChar, `%${rawSearch}%`);
                queryStr += ' WHERE Name LIKE @searchPattern';
            }

            let result = await request.query(queryStr);
            exams = result.recordset; 
        } catch (dbErr) {
            console.error("Database fetch failed, falling back to empty list:", dbErr.message);
            exams = []; 
        }

        res.render('index', { 
            title: "Home", 
            message: "", 
            searchValue: rawSearch,
            exams 
        });

    } catch (err) {
        res.render('error', { title: 'Error', detail: `Page '${req.url}' not found.` });
    }
});

app.get('/about', (req, res) => {
    res.render('about', { title: 'About' });
});

app.use(authController);
app.use('/users', userController);
app.use('/exams', examController);
app.use('/subjects', subjectController);
app.use('/questions', questionController);
app.use('/options', optionController);
app.use('/answers', answerController);
app.use('/schools', schoolController);

app.use((req, res) => {
    res.render('error', { title: 'Error', detail: `Page '${req.url}' not found.` });
});

// ==========================================================
// SERVER STARTUP LOGIC
// ==========================================================
module.exports = app;

if (require.main === module) {
    const appPort = process.env.PORT || port || 3000;
    
    if (process.env.NODE_ENV === 'production') {
        app.listen(appPort, () => {
            console.log(`Production Admin server running on port ${appPort}`);
        });
    }
    else {
        const httpsOptions = {
            key: fs.readFileSync('./key.pem'),
            cert: fs.readFileSync('./cert.pem')
        };
        const server = https.createServer(httpsOptions, app);
        server.listen(appPort, () => {
            console.log(`HTTPS Development Admin server running on https://localhost:${appPort}`);
        });
    }
}