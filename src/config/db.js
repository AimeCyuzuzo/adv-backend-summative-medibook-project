const mysql = require('mysql2/promise');

// One shared connection pool for the whole app.
// Models import this; controllers and routes never do.
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATETIME columns as 'YYYY-MM-DD HH:MM:SS' strings instead of JS Dates,
  // so clinic times are never shifted by the server's timezone.
  dateStrings: true,
  // Return DECIMAL columns as numbers (e.g. 150) instead of strings ('150.00').
  decimalNumbers: true,
});

module.exports = pool;
