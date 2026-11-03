const pool = require('../db');

// SCP-F-014 dashboard queries. Every filter is optional: a null value switches
// that condition off, so each query stays one fixed, parameterised statement
// (SCP-SR-004) with no SQL built from strings.
//
// filters: { clubId, status, from, to }  (from / to are 'YYYY-MM-DD' on the submitted date)

function filterParams({ clubId = null, status = null, from = null, to = null }) {
  return [clubId, clubId, status, status, from, from, to, to];
}

// Count and total budget per status (the approval pipeline).
async function pipeline(filters) {
  const [rows] = await pool.execute(
    `SELECT p.status, COUNT(*) AS count, COALESCE(SUM(p.budget), 0) AS budget
       FROM proposals p
      WHERE (? IS NULL OR p.club_id = ?)
        AND (? IS NULL OR p.status = ?)
        AND (? IS NULL OR DATE(p.created_at) >= ?)
        AND (? IS NULL OR DATE(p.created_at) <= ?)
      GROUP BY p.status`,
    filterParams(filters)
  );
  return rows;
}

// Proposal table, newest first. days_in_status = days since the last status change.
async function listProposals(filters) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.event_name, c.name AS club_name, p.event_date, p.budget, p.status,
            p.created_at, DATEDIFF(CURDATE(), DATE(p.updated_at)) AS days_in_status
       FROM proposals p
       JOIN clubs c ON c.id = p.club_id
      WHERE (? IS NULL OR p.club_id = ?)
        AND (? IS NULL OR p.status = ?)
        AND (? IS NULL OR DATE(p.created_at) >= ?)
        AND (? IS NULL OR DATE(p.created_at) <= ?)
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 200`,
    filterParams(filters)
  );
  return rows;
}

async function listClubs() {
  const [rows] = await pool.execute('SELECT id, name FROM clubs ORDER BY name');
  return rows;
}

module.exports = { pipeline, listProposals, listClubs };
