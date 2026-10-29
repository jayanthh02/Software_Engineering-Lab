const pool = require('../db');

// All queries are parameterised (SCP-SR-004).

async function createForUser(userId, message, proposalId) {
  await pool.execute(
    'INSERT INTO notifications (user_id, proposal_id, message) VALUES (?, ?, ?)',
    [userId, proposalId, message]
  );
}

// One notification for every user with this role (e.g. all FINANCE users).
async function createForRole(role, message, proposalId) {
  await pool.execute(
    'INSERT INTO notifications (user_id, proposal_id, message) SELECT id, ?, ? FROM users WHERE role = ?',
    [proposalId, message, role]
  );
}

// Newest 50 first.
async function listForUser(userId) {
  const [rows] = await pool.execute(
    `SELECT id, proposal_id, message, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`,
    [userId]
  );
  return rows;
}

async function countUnread(userId) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = FALSE',
    [userId]
  );
  return Number(rows[0].n);
}

// Only marks the notification if it belongs to this user. Returns true if a row matched.
async function markRead(id, userId) {
  const [result] = await pool.execute(
    'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return result.affectedRows > 0;
}

async function markAllRead(userId) {
  await pool.execute('UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE', [
    userId,
  ]);
}

module.exports = { createForUser, createForRole, listForUser, countUnread, markRead, markAllRead };
