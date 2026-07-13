const path = require('path');
const https = require('https');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const flash = require("connect-flash");
const multer = require('multer');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config(); // Load environment variables from .env file

const { hostname, port, apihost } = require(path.join(__dirname, 'config'));

const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const examController = require('./controllers/examController');
const subjectController = require('./controllers/subjectController');
const questionController = require('./controllers/questionController');
const optionController = require('./controllers/optionController');
const answerController = require('./controllers/answerController');
const schoolController = require('./controllers/schoolController');

const { makeApiRequest } = require("./controllers/_baseController");

const app = express();
app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', 'views');

if (process.env.NODE_ENV === 'production') {
    const storeMSSQL = require('connect-mssql')(session);
    
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
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: new storeMSSQL(dbConfig), // Use your Azure DB config here
        cookie: {
            httpOnly: true,
            maxAge: 3600000,       // 1 hour session timeout
            sameSite: 'none',       // allow POST redirects and cross-origin form submissions
            secure: true          // must be false for HTTP (local dev); true for HTTPS in production
        }
    }));
}
else {
    app.use(session({
        secret: '67b8621fc96406bd6cd2fc11',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            maxAge: 3600000,       // 1 hour session timeout
            sameSite: 'none',       // allow POST redirects and cross-origin form submissions
            secure: true          // must be false for HTTP (local dev); true for HTTPS in production
        }
    }));
}

app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(cors()); // Enable CORS for all routes (adjust as needed for security)
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
        console.log('Host: ', req.hostname + ' ' + req.path + ' ' + req.method);
    }
    next();
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); // Define the filename.
        const fileExtension = path.extname(file.originalname);
        cb(null, uniqueSuffix + fileExtension); //file.fieldname + '-' + 
    }
});

// Create the multer instance with the configured storage 'image' here must match the field name in curl command/Android upload
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // Optional: Limit file size to 10MB
    },
    fileFilter: (req, file, cb) => {
        // Optional: Filter file types
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// This handles the POST request to /upload
app.post('/upload', upload.single('image'), (req, res) => {
    // 'image' is the field name from your curl command (-F "image=@...")

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

// --- Error Handling Middleware (important for debugging) ---
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        console.error("Multer error:", err.message);
        return res.status(400).send(`Multer Error: ${err.message}`);
    } else if (err) {
        // An unknown error occurred
        console.error("General error:", err.message);
        return res.status(500).send(`Server Error: ${err.message}`);
    }
    next();
});

app.get('/', async (req, res) => {
    if (!req.session || !req.session.isLoggedIn) return res.redirect('/login');
    
    try {
        const user = req.session.user;
        if (!user) {
            return res.render('error', { title: 'Error', detail: "No user found in session." });
        }

        // Get the raw search string from the URL query parameters
        let rawSearch = req.query.searchValue || "";
        let searchValue = rawSearch !== '' ? encodeURIComponent(rawSearch) : "";

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

            // If the user typed a search term, filter the SQL query dynamically
            if (rawSearch !== '') {
                // Use a parameterized input to safely match your 'Name' column without SQL injection risk
                request.input('searchPattern', sql.VarChar, `%${rawSearch}%`);
                queryStr += ' WHERE Name LIKE @searchPattern';
            }

            let result = await request.query(queryStr);
            exams = result.recordset; 
        } catch (dbErr) {
            console.error("Database fetch failed, falling back to empty list:", dbErr.message);
            exams = []; 
        }

        // Pass 'exams' along with the decoded search value back to the view
        res.render('index', { 
            title: "Home", 
            message: "", 
            searchValue: rawSearch, // Pass the clean unencoded string back so the text input preserves what they typed
            exams 
        });

    } catch (err) {
        res.render('error', { title: 'Error', detail: `Page '${req.url}' not found.` });
    }
});

app.get('/about', (req, res) => {
    res.render('about', { title: 'About' });
});

app.get('/users', (req, res) => {
    res.redirect('/users');
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

if (process.env.NODE_ENV === 'production') {
    // A production environment will have proper certificates
    app.listen(port);
}
else {
    // Read the generated certificate and key
    const httpsOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
    };

    const server = https.createServer(httpsOptions, app);

    server.listen(port, () => {
        console.log(`HTTPS Development server running on https://localhost:${port}`);
    });
}