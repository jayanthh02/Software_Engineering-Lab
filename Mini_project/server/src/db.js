const mysql = require('mysql2/promise');
const config = require('./config');

// One shared connection pool. Always call pool.execute(sql, [params])
// so every query is parameterised (SCP-SR-004).
const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
