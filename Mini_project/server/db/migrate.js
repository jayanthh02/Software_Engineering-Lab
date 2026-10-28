// Usage: npm run migrate
// Creates the database (if missing) and runs schema.sql.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

(async () => {
  const { database, ...conn } = config.db;
  const connection = await mysql.createConnection({ ...conn, multipleStatements: true });
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await connection.query(`USE \`${database}\``);
    await connection.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('Migration complete');
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
