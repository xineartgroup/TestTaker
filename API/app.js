const path = require('path');
const https = require('https');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const flash = require("connect-flash");
const cookieParser = require('cookie-parser');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const { hostname, port } = require(path.join(__dirname, 'config'));

// --- Import Existing API Controllers ---
const authapiController = require('./middleware/authAPIController');
const loginapiController = require('./middleware/loginAPIController');
const notificationapiController = require('./middleware/notificationAPIController');
const paymentapiController = require('./middleware/paymentAPIController');
const userapiController = require('./middleware/userAPIController');
const examapiController = require('./middleware/examAPIController');
const subjectapiController = require('./middleware/subjectAPIController');
const questionapiController = require('./middleware/questionAPIController');
const optionapiController = require('./middleware/optionAPIController');
const answerapiController = require('./middleware/answerAPIController');
const schoolapiController = require('./middleware/schoolAPIController');

const { generateToken, authenticateToken, checkPermission } = require("./middleware/_baseAPIController");

const app = express();
app.set('trust proxy', 1);

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("Firebase initialized successfully from Azure environment variable.");
    } catch (err) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:", err.message);
    }
} else {
    try {
        // This require is safely trapped. It will only run if the env var is missing.
        const serviceAccount = require(path.join(__dirname, 'fcm_service_account_key.json'));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("Firebase initialized from local file.");
    } catch (err) {
        console.log("Firebase service account key not found. Skipping Firebase initialization.");
    }
}

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
    origin: process.env.ALLOWED_APP_URL || `http://${hostname}:${port}`,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- CRITICAL FIX: Share the MSSQL Session Store with the Web App ---
if (process.env.NODE_ENV === 'production') {
    const storeMSSQL = require('connect-mssql')(session);
    
    const dbConfig = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_HOST,
        database: process.env.DB_NAME,
        options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
        port: 1433
    };

    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: new storeMSSQL(dbConfig),
        cookie: { maxAge: 3600000, secure: true, sameSite: 'none' }
    }));
} else {
    app.use(session({
        secret: process.env.SESSION_SECRET || 'dev-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 3600000, secure: false, sameSite: 'none' }
    }));
}

app.use(flash());

app.use((req, res, next) => {
    res.locals.message = req.flash("message");
    res.locals.error = req.flash("error");
    res.locals.session = req.session;
    next();
});

app.use((req, res, next) => {
    console.log('API Host: ', req.protocol + "://" + req.get('host') + req.path + ' ' + req.method);
    next();
});

// --- FIXED: Removed '/api' prefix because root app.js already provides it ---
app.use('/auth', authapiController);
app.use('/logins', loginapiController);
app.use('/notifications', notificationapiController);
app.use('/payment', paymentapiController);
app.use('/users', userapiController);
app.use('/exams', examapiController);
app.use('/subjects', subjectapiController);
app.use('/questions', questionapiController);
app.use('/options', optionapiController);
app.use('/answers', answerapiController);
app.use('/schools', schoolapiController);

// ==========================================================
// SERVER STARTUP LOGIC
// ==========================================================
module.exports = app;

if (require.main === module) {
    const appPort = process.env.PORT || port || 3000;

    if (process.env.NODE_ENV === 'production') {
        app.listen(appPort, () => {
            console.log(`Production API server running on port ${appPort}`);
        });
    } else {
        const httpsOptions = {
            key: fs.readFileSync('./key.pem'),
            cert: fs.readFileSync('./cert.pem')
        };
        const server = https.createServer(httpsOptions, app);
        server.listen(appPort, () => {
            console.log(`HTTPS Development API server running on https://localhost:${appPort}`);
        });
    }
}