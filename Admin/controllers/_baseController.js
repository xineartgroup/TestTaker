const http = require('http');
const https = require('https');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));

const makeApiRequest = (method, reqPath, expressReq = null, data = null) => {
    return new Promise((resolve, reject) => {
        if (!config.apihost) {
            return reject("API host is not configured");
        }

        const postData = data ? JSON.stringify(data) : null;

        try {
            const url = new URL(config.apihost);
            const protocol = url.protocol;
            
            // FORCE IPv4 to prevent silent localhost/IPv6 certificate failures
            const hostname = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname;
            const port = url.port || (protocol === 'https:' ? 443 : 80);

            const headers = {
                'Content-Type': 'application/json'
            };

            if (postData) {
                headers['Content-Length'] = Buffer.byteLength(postData);
            }

            if (expressReq && expressReq.headers.cookie) {
                headers['Cookie'] = expressReq.headers.cookie;
            }

            const options = {
                hostname: hostname,
                port: port,
                path: reqPath,
                method: method,
                headers: headers,
                // Allow self-signed certificates in development
                rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false
            };

            console.log(`[API Request] ${method} ${protocol}//${hostname}:${port}${reqPath}`);

            const requestModule = protocol === 'https:' ? https : http;

            const req = requestModule.request(options, (response) => {
                let responseData = '';

                response.on('data', (chunk) => {
                    responseData += chunk;
                });

                response.on('end', () => {
                    try {
                        if (responseData.trim() === '') {
                            resolve(null);
                        } else {
                            const result = JSON.parse(responseData);
                            resolve(result);
                        }
                    } catch (error) {
                        console.error('JSON Parse Error:', error.message);
                        console.error('Response Data:', responseData);
                        reject("Invalid JSON response: " + error.message);
                    }
                });
            });

            req.on('error', (error) => {
                // Capture code, message, and full error to prevent empty logs
                const errorMsg = error.message || error.code || JSON.stringify(error);
                console.error('=== REQUEST FAILED ===');
                console.error('Error Code:', error.code);
                console.error('Error Message:', error.message);
                console.error('Full Error:', error);
                console.error('======================');
                reject("Request error: " + errorMsg);
            });

            req.setTimeout(30000, () => {
                req.destroy();
                reject("Request timeout after 30 seconds");
            });

            if (postData) {
                req.write(postData);
            }

            req.end();

        } catch (error) {
            reject("Invalid API host configuration: " + error.message);
        }
    });
};

module.exports = { makeApiRequest };