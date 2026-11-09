const pool = require('../db');

// SCP-23 (SCP-F-010): approved proposals are the events students can register for.
// Read-only. Registration itself stays in registrationRepo. Parameterised (SCP-SR-004).

// Approved events from today onwards, soonest first, with how many students registered.
// `mine` is 1 when studentId has registered (studentId may be null for other roles).
async function listUpcoming(studentId) {
  const [rows] = await pool.execute(
    `SELECT p.id, c.name AS club_name, p.event_name, p.event_date, p.venue,
            p.description, p.expected_attendance,
            COUNT(r.id) AS registered,
            SUM(CASE WHEN r.student_id = ? THEN 1 ELSE 0 END) AS mine
       FROM proposals p
       JOIN clubs c ON c.id = p.club_id
       LEFT JOIN registrations r ON r.proposal_id = p.id
      WHERE p.status = 'APPROVED'
        AND p.event_date >= CURDATE()
      GROUP BY p.id, c.name
      ORDER BY p.event_date, p.id`,
    [studentId]
  );
  return rows;
}

module.exports = { listUpcoming };
