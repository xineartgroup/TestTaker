const path = require('path');
const https = require('https');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const flash = require("connect-flash");
const cookieParser = require('cookie-parser');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config(); // Load environment variables from .env file

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

const { generateToken, authenticateToken, checkPermission } = require("./middleware/_baseAPIController");

const app = express();

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
    const serviceAccount = require(path.join(__dirname, 'fcm_service_account_key.json'));
    admin.initializeApp({
     credential: admin.credential.cert(serviceAccount)
    });
}

app.use(express.json());
app.use(express.static('public')); // all static files in 'public' folder will be accessible to the app
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploads directory
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
    origin: process.env.ALLOWED_APP_URL, // `http://${hostname}:${port}`,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

if (process.env.NODE_ENV === 'production') {
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 3600000, // session timeout of 60 minutes
            secure: true,
            sameSite: 'none'
        }
    }));
}
else {
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 3600000, // session timeout of 60 minutes
            secure: false,
            sameSite: 'none'
        }
    }));
}

app.use(flash());

app.use((req, res, next) => {
    res.locals.message = req.flash("message");
    res.locals.error = req.flash("error");
    res.locals.session = req.session;  // Makes session available in all views
    next();
});

app.use((req, res, next) => {
    console.log('Host: ', req.protocol + "://" + req.get('host') + req.path + ' ' + req.method); // req.hostname
    next();
});

// --- Mount API Controller Routers ---
app.use('/api/auth', authapiController);
app.use('/api/logins', loginapiController);
app.use('/api/notifications', notificationapiController);
app.use('/api/payment', paymentapiController);
app.use('/api/users', userapiController);
app.use('/api/exams', examapiController);
app.use('/api/subjects', subjectapiController);
app.use('/api/questions', questionapiController);
app.use('/api/options', optionapiController);
app.use('/api/answers', answerapiController);

app.use('/api', (req, res) => {
    res.status(200).json({ message: 'API is working' });
});
app.use((req, res) => {
    res.status(200).json({ message: 'Site is working' });
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
        console.log(`HTTPS Development server running on ://localhost:${port}`);
    });
}