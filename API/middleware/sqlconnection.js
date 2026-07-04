const sql = require('mssql');
const cors = require('cors');
const express = require('express');

const app = express();
app.use(cors());

let config;

console.log("process.env.NODE_ENV", process.env.NODE_ENV);

if (process.env.NODE_ENV === 'production') {
    // Configuration for Azure SQL Database
    config = {
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
} else {
    // Configuration for Local SQL Express
    config = {
        user: process.env.DB_USER || "obinna",
        password: process.env.DB_PASSWORD || "P@$$w0rd",
        server: process.env.DB_HOST || "CHIKWENDU_PC\\SQLEXPRESS",
        database: process.env.DB_NAME || "TestTaker",
        options: {
            trustServerCertificate: true,
            enableArithAbort: true,
            instancename: "SQLEXPRESS"
        },
        port: 1433
    };
}

async function getPool() {
    try {
        return await sql.connect(config);
    } catch (error) {
        console.error("Database connection error:", error);
        throw error;
    }
}

module.exports = getPool;