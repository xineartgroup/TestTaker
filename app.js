const path = require('path');

// 1. MUST BE FIRST: Load environment variables before importing apps
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const fs = require('fs');
const https = require('https');

// 2. Import the shared config
const { hostname, port, apihost } = require(path.join(__dirname, 'config'));

// 3. Import the three apps
const webApp = require('./Web/app');
const adminApp = require('./Admin/app');
const apiApp = require('./API/app');

// 4. Create the Express application
const app = express();

// 5. Mount the apps to their respective routes (ORDER MATTERS!)
// Specific routes MUST come before the general '/' route
app.use('/api', apiApp);        // API app handles /api URLs
app.use('/admin', adminApp);    // Admin app handles /admin URLs
app.use('/', webApp);           // Web app handles everything else (root URL)

// 6. Server Startup Logic
const appPort = port || 3000;

if (process.env.NODE_ENV === 'production') {
    app.listen(appPort, () => {
        console.log(`Production server running on port ${appPort}`);
    });
} else {
    const httpsOptions = {
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem')
    };

    const server = https.createServer(httpsOptions, app);

    server.listen(appPort, () => {
        console.log(`HTTPS Development server running on https://localhost:${appPort}`);
    });
}