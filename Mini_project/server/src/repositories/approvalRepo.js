const pool = require('../db');

// All queries are parameterised (SCP-SR-004).

// Proposals waiting at one stage, oldest first, with the club name.
async function listByStatus(status) {
  const [rows] = await pool.execute(
    `SELECT p.id, p.event_name, p.event_date, p.venue, p.expected_attendance, p.budget,
            p.description, p.status, p.created_at, c.name AS club_name
       FROM proposals p JOIN clubs c ON c.id = p.club_id
      WHERE p.status = ?
      ORDER BY p.created_at ASC, p.id ASC`,
    [status]
  );
  return rows;
}

async function findProposalById(id) {
  const [rows] = await pool.execute(
    'SELECT id, event_name, club_lead_id, status FROM proposals WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

/**
 * Moves the proposal from `fromStatus` to `toStatus` and writes the audit row,
 * in one transaction. The UPDATE only matches if the status is still `fromStatus`,
 * so two approvers deciding at the same time cannot both succeed.
 * Returns true if the decision was recorded, false if the status had already changed.
 */
async function recordDecision({ proposalId, fromStatus, toStatus, stage, approverId, decision, comment }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      'UPDATE proposals SET status = ? WHERE id = ? AND status = ?',
      [toStatus, proposalId, fromStatus]
    );
    if (result.affectedRows === 0) {
      await conn.rollback();
      return false;
    }
    await conn.execute(
      'INSERT INTO approval_history (proposal_id, stage, approver_id, decision, comment) VALUES (?, ?, ?, ?, ?)',
      [proposalId, stage, approverId, decision, comment]
    );
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getApprovalHistory(proposalId) {
  const [rows] = await pool.execute(
    `SELECT ah.proposal_id, ah.stage, ah.approver_id, ah.decision,
            ah.comment, ah.created_at
       FROM approval_history ah
      WHERE ah.proposal_id = ?
      ORDER BY ah.created_at ASC`,
    [proposalId]
  );
  return rows;
}

module.exports = {
  listByStatus,
  findProposalById,
  recordDecision,
  getApprovalHistory,
};
