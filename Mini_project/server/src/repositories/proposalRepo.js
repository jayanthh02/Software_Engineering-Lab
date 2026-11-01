const pool = require('../db');

// All queries are parameterised (SCP-SR-004).

// SCP-F-003: saves a new proposal. The status column defaults to PENDING_FACULTY,
// but we set it explicitly so the rule is visible here.
// Returns the new proposal id.
async function create({ clubId, clubLeadId, eventName, eventDate, venue, expectedAttendance, budget, description }) {
  const [result] = await pool.execute(
    `INSERT INTO proposals
       (club_id, club_lead_id, event_name, event_date, venue, expected_attendance, budget, description, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_FACULTY')`,
    [clubId, clubLeadId, eventName, eventDate, venue, expectedAttendance, budget, description]
  );
  return result.insertId;
}

// SCP-F-004: proposals of one club, newest first, with the comment of the most recent
// rejection (so the Club Lead sees why it was rejected). `status` is optional.
// event_date is returned as a plain YYYY-MM-DD string so no timezone can shift the day.
async function listByClub(clubId, status) {
  const params = [clubId];
  let where = 'p.club_id = ?';
  if (status) {
    where += ' AND p.status = ?';
    params.push(status);
  }
  const [rows] = await pool.execute(
    `SELECT p.id, p.club_id, p.event_name, DATE_FORMAT(p.event_date, '%Y-%m-%d') AS event_date,
            p.venue, p.expected_attendance, p.budget, p.description, p.status, p.created_at, p.updated_at,
            (SELECT ah.comment FROM approval_history ah
              WHERE ah.proposal_id = p.id AND ah.decision = 'REJECT'
              ORDER BY ah.created_at DESC, ah.id DESC LIMIT 1) AS rejection_comment
       FROM proposals p
      WHERE ${where}
      ORDER BY p.created_at DESC, p.id DESC`,
    params
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT id, club_id, club_lead_id, event_name, status
       FROM proposals WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * SCP-F-004: replaces the proposal's details and sends it back to the Faculty stage.
 * The UPDATE only matches while the status is still REJECTED, so two resubmits (or a
 * resubmit racing anything else) cannot both succeed. approval_history is not touched,
 * so every earlier decision is kept.
 * Returns true if the proposal was updated, false if it was no longer REJECTED.
 */
async function resubmit(id, { eventName, eventDate, venue, expectedAttendance, budget, description }) {
  const [result] = await pool.execute(
    `UPDATE proposals
        SET event_name = ?, event_date = ?, venue = ?, expected_attendance = ?,
            budget = ?, description = ?, status = 'PENDING_FACULTY'
      WHERE id = ? AND status = 'REJECTED'`,
    [eventName, eventDate, venue, expectedAttendance, budget, description, id]
  );
  return result.affectedRows === 1;
}

module.exports = { create, listByClub, findById, resubmit };
