const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'jelou_b2b',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function waitForDB(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await pool.getConnection();
      await conn.query('SELECT 1');
      conn.release();
      console.log('Database connection established');
      return;
    } catch (err) {
      console.log(`Waiting for database... attempt ${i + 1}/${retries}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Could not connect to database after retries');
}

module.exports = pool;
module.exports.waitForDB = waitForDB;
