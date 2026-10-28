const pool = require('../db');

// Parameterised query: the email is never concatenated into the SQL.
async function findByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT id, name, email, password_hash, role, club_id FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
}

module.exports = { findByEmail };
