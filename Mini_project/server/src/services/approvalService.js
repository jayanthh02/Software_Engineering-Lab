const approvalRepo = require('../repositories/approvalRepo');
const notificationService = require('./notificationService');

// SCP-F-006: fixed order Faculty -> Finance -> Dean.
// SCP-F-007: only the approver of the current stage may approve or reject.

// The status each approver role is allowed to act on.
const STAGE_STATUS = {
  FACULTY: 'PENDING_FACULTY',
  FINANCE: 'PENDING_FINANCE',
  DEAN: 'PENDING_DEAN',
};

// Where an approval sends the proposal next.
const NEXT_STATUS = {
  PENDING_FACULTY: 'PENDING_FINANCE',
  PENDING_FINANCE: 'PENDING_DEAN',
  PENDING_DEAN: 'APPROVED',
};

const APPROVER_ROLES = Object.keys(STAGE_STATUS);

class ApprovalError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function isApprover(role) {
  return APPROVER_ROLES.includes(role);
}

// Proposals waiting at the caller's stage (the approver inbox).
async function inbox(role) {
  const rows = await approvalRepo.listByStatus(STAGE_STATUS[role]);
  return rows.map((p) => ({
    id: p.id,
    eventName: p.event_name,
    clubName: p.club_name,
    eventDate: p.event_date,
    venue: p.venue,
    expectedAttendance: p.expected_attendance,
    budget: Number(p.budget),
    description: p.description,
    status: p.status,
    submittedAt: p.created_at,
  }));
}

/**
 * Record an approve / reject decision. Throws ApprovalError for 403 / 404 / 409.
 * Returns { proposalId, newStatus }.
 */
async function decide({ proposalId, decision, comment, user }) {
  const proposal = await approvalRepo.findProposalById(proposalId);
  if (!proposal) {
    throw new ApprovalError(404, 'NOT_FOUND', 'Proposal not found');
  }

  const myStatus = STAGE_STATUS[user.role];
  if (proposal.status !== myStatus) {
    throw new ApprovalError(403, 'NOT_CURRENT_STAGE', 'This proposal is not waiting at your stage');
  }

  const newStatus = decision === 'APPROVE' ? NEXT_STATUS[myStatus] : 'REJECTED';
  const recorded = await approvalRepo.recordDecision({
    proposalId,
    fromStatus: myStatus,
    toStatus: newStatus,
    stage: user.role,
    approverId: user.id,
    decision,
    comment: comment || null,
  });
  if (!recorded) {
    throw new ApprovalError(409, 'ALREADY_DECIDED', 'This proposal was already decided at this stage');
  }

  // The decision is already saved; a notification problem must not turn it into an error.
  try {
    await notificationService.notifyStatusChange(
      { id: proposal.id, eventName: proposal.event_name, clubLeadId: proposal.club_lead_id },
      myStatus,
      newStatus
    );
  } catch (err) {
    console.error('Notification failed:', err.message);
  }

  return { proposalId, newStatus };
}

async function getApprovalHistory(proposalId, user) {
  if (!isApprover(user.role)) {
    throw new ApprovalError(403, 'FORBIDDEN', 'Only approvers can view approval history');
  }

  const proposal = await approvalRepo.findProposalById(proposalId);
  if (!proposal) {
    throw new ApprovalError(404, 'NOT_FOUND', 'Proposal not found');
  }

  return approvalRepo.getApprovalHistory(proposalId);
}

module.exports = {
  inbox,
  decide,
  isApprover,
  ApprovalError,
  APPROVER_ROLES,
  getApprovalHistory,
};