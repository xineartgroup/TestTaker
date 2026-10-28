const mysql = require('mysql2/promise');

let pool;

function createPool() {
    console.log("process.env.NODE_ENV", process.env.NODE_ENV);

    let config;

    if (process.env.NODE_ENV === 'production') {
        // Production (e.g. managed MySQL — PlanetScale, RDS, Azure MySQL, etc.)
        config = {
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: { rejectUnauthorized: true }
        };
    } else {
        // Local MySQL
        config = {
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'TestTaker'
        };
    }

    return mysql.createPool({
        ...config,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4_unicode_ci',
        dateStrings: false,
        typeCast: (field, next) => {
            if (field.type === 'TINY' && field.length === 1) {
                return field.string() === '1';
            }
            return next();
        }
    });
}

async function getPool() {
    if (!pool) pool = createPool();
    return pool;
}

module.exports = getPool;