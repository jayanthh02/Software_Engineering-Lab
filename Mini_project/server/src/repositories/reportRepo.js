const pool = require('../db');

// SCP-F-015 report queries. Optional filters use "(? IS NULL OR ...)" so each
// query is one fixed, parameterised statement (SCP-SR-004).

// Budget allocation report. Same filters as the dashboard (club, submitted date),
// so the totals match the dashboard totals for the same filters.
async function budgetRows({ clubId = null, from = null, to = null }) {
  const [rows] = await pool.execute(
    `SELECT p.id, c.name AS club_name, p.event_name, p.event_date, p.status, p.budget, p.created_at
       FROM proposals p
       JOIN clubs c ON c.id = p.club_id
      WHERE (? IS NULL OR p.club_id = ?)
        AND (? IS NULL OR DATE(p.created_at) >= ?)
        AND (? IS NULL OR DATE(p.created_at) <= ?)
      ORDER BY c.name ASC, p.created_at ASC, p.id ASC`,
    [clubId, clubId, from, from, to, to]
  );
  return rows;
}

// Attendance report for approved events (filtered on the event date):
// expected attendance, students registered and tickets issued.
async function attendanceRows({ clubId = null, from = null, to = null }) {
  const [rows] = await pool.execute(
    `SELECT p.id, c.name AS club_name, p.event_name, p.event_date, p.venue,
            p.expected_attendance,
            COUNT(DISTINCT r.id) AS registered,
            COUNT(DISTINCT t.id) AS tickets_issued
       FROM proposals p
       JOIN clubs c ON c.id = p.club_id
       LEFT JOIN registrations r ON r.proposal_id = p.id
       LEFT JOIN tickets t ON t.registration_id = r.id
      WHERE p.status = 'APPROVED'
        AND (? IS NULL OR p.club_id = ?)
        AND (? IS NULL OR p.event_date >= ?)
        AND (? IS NULL OR p.event_date <= ?)
      GROUP BY p.id, c.name, p.event_name, p.event_date, p.venue, p.expected_attendance
      ORDER BY p.event_date ASC, p.id ASC`,
    [clubId, clubId, from, from, to, to]
  );
  return rows;
}

module.exports = { budgetRows, attendanceRows };
