const pool = require('../db');

// SCP-19: read-only lookups for "My Tickets". Tickets are created in
// registrationRepo (SCP-18); nothing here inserts or changes a ticket.
// All queries are parameterised (SCP-SR-004).

const TICKET_SELECT = `
  SELECT t.id, t.registration_id, t.ticket_code, t.signature, t.created_at,
         r.proposal_id, r.student_id,
         p.event_name, p.event_date, p.venue
    FROM tickets t
    JOIN registrations r ON r.id = t.registration_id
    JOIN proposals p ON p.id = r.proposal_id`;

// Only this student's tickets, newest first.
async function listForStudent(studentId) {
  const [rows] = await pool.execute(
    `${TICKET_SELECT} WHERE r.student_id = ? ORDER BY t.created_at DESC, t.id DESC`,
    [studentId]
  );
  return rows;
}

// Returns the ticket row (including student_id so the caller can check ownership) or null.
async function findById(id) {
  const [rows] = await pool.execute(`${TICKET_SELECT} WHERE t.id = ?`, [id]);
  return rows[0] || null;
}

module.exports = { listForStudent, findById };
