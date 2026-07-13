const http = require('http');
const https = require('https');
const path = require('path');
const config = require(path.join(__dirname, '..', 'config'));

const makeApiRequest = (method, path, expressReq = null, data = null) => {
    return new Promise((resolve, reject) => {
        if (!config.apihost) {
            return reject("API host is not configured");
        }

        const postData = data ? JSON.stringify(data) : null;

        try {
            //console.log("config.apihost", config.apihost);
            const url = new URL(config.apihost);
            const protocol = url.protocol;
            const hostname = url.hostname;
            const port = url.port || (protocol === 'https:' ? 443 : 80); // Use default ports if not specified

            const headers = {
                'Content-Type': 'application/json'
            };

            // Add Content-Length if there's post data
            if (postData) {
                headers['Content-Length'] = Buffer.byteLength(postData);
            }

            // First try to use token from session
            //if (expressReq && expressReq.session && expressReq.session.token) {
            //    headers['Authorization'] = `Bearer ${expressReq.session.token}`;
            //}

            // Fall back to cookie forwarding
            if (expressReq && expressReq.headers.cookie) {
                headers['Cookie'] = expressReq.headers.cookie;
            }

            const options = {
                hostname: hostname,
                port: port,
                path: path,
                method: method,
                headers: headers,
                // Allow self-signed certificates in development
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            };

            // Choose the appropriate protocol module
            const requestModule = protocol === 'https:' ? https : http;

            const req = requestModule.request(options, (response) => {
                let responseData = '';

                response.on('data', (chunk) => {
                    responseData += chunk;
                });

                response.on('end', () => {
                    try {
                        if (responseData.trim() === '') {
                            resolve(null); // Empty response
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
                console.error('Request Error:', error.message);
                reject("Request error: " + error.message);
            });

            // Set timeout to prevent hanging requests
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