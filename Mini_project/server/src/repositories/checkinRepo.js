const pool = require('../db');

// SCP-20 (SCP-F-013): ticket check-in. All queries are parameterised (SCP-SR-004).

// Finds a ticket by its code, with the event it belongs to and the student who holds it.
// Returns null if no ticket has this code.
async function findTicketByCode(ticketCode) {
  const [rows] = await pool.execute(
    `SELECT t.id, t.registration_id, t.ticket_code, t.signature,
            r.proposal_id, p.club_id, p.event_name, u.name AS student_name
       FROM tickets t
       JOIN registrations r ON r.id = t.registration_id
       JOIN proposals p ON p.id = r.proposal_id
       JOIN users u ON u.id = r.student_id
      WHERE t.ticket_code = ?
      LIMIT 1`,
    [ticketCode]
  );
  return rows[0] || null;
}

// Marks the ticket as USED. The UNIQUE (ticket_id) column means only one scan can win,
// even when two arrive at the same moment.
// Returns true if this call used the ticket, false if it was already used.
async function markUsed(ticketId, checkedInBy) {
  try {
    await pool.execute('INSERT INTO checkins (ticket_id, checked_in_by) VALUES (?, ?)', [
      ticketId,
      checkedInBy,
    ]);
    return true;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return false;
    throw error;
  }
}

module.exports = { findTicketByCode, markUsed };
