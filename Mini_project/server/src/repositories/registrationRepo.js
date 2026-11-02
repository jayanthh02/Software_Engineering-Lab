
const db = require('../db');

async function register(proposalId, studentId) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [proposals] = await connection.query(
      `SELECT id, status, expected_attendance
       FROM proposals
       WHERE id = ?
       FOR UPDATE`,
      [proposalId]
    );

    if (proposals.length === 0) {
      const error = new Error('Event proposal not found');
      error.status = 404;
      error.code = 'PROPOSAL_NOT_FOUND';
      throw error;
    }

    const proposal = proposals[0];

    if (proposal.status !== 'APPROVED') {
      const error = new Error('Only approved events can be registered for');
      error.status = 409;
      error.code = 'EVENT_NOT_APPROVED';
      throw error;
    }

    const [existing] = await connection.query(
      'SELECT id FROM registrations WHERE proposal_id = ? AND student_id = ?',
      [proposalId, studentId]
    );

    if (existing.length > 0) {
      const error = new Error('You are already registered for this event');
      error.status = 409;
      error.code = 'ALREADY_REGISTERED';
      throw error;
    }

    const [counts] = await connection.query(
      'SELECT COUNT(*) AS total FROM registrations WHERE proposal_id = ?',
      [proposalId]
    );

    if (Number(counts[0].total) >= Number(proposal.expected_attendance)) {
      const error = new Error('This event has reached its registration capacity');
      error.status = 409;
      error.code = 'EVENT_FULL';
      throw error;
    }

    const [result] = await connection.query(
      'INSERT INTO registrations (proposal_id, student_id) VALUES (?, ?)',
      [proposalId, studentId]
    );

    await connection.commit();

    return {
      registrationId: result.insertId,
      proposalId,
      registered: true,
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      error.status = 409;
      error.code = 'ALREADY_REGISTERED';
      error.message = 'You are already registered for this event';
    }

    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { register };
