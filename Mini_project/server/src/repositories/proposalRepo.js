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

module.exports = { create };
