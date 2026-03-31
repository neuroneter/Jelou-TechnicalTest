require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_NAME || 'jelou_b2b',
    multipleStatements: true,
  });

  const seedPath = path.join(__dirname, '..', '..', 'db', 'seed.sql');
  const seedSQL = fs.readFileSync(seedPath, 'utf8');
  await connection.query(seedSQL);
  console.log('Seed data inserted successfully');
  await connection.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
