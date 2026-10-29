const notificationRepo = require('../repositories/notificationRepo');

// SCP-F-009: notify the next approver when a proposal reaches their stage,
// and the Club Lead on every approval or rejection.

// Which role must act when a proposal enters this status.
const NEXT_APPROVER = {
  PENDING_FACULTY: 'FACULTY',
  PENDING_FINANCE: 'FINANCE',
  PENDING_DEAN: 'DEAN',
};

const STAGE_LABEL = {
  PENDING_FACULTY: 'Faculty Coordinator',
  PENDING_FINANCE: 'Finance Officer',
  PENDING_DEAN: 'Dean',
};

const MAX_MESSAGE = 255; // notifications.message column size

function clip(text) {
  return text.length > MAX_MESSAGE ? `${text.slice(0, MAX_MESSAGE - 3)}...` : text;
}

/**
 * Call this after a proposal's status changes (submit, resubmit, approve, reject).
 * proposal: { id, eventName, clubLeadId }
 * previousStatus: the status before the change (null for a new submission)
 * newStatus: PENDING_FACULTY | PENDING_FINANCE | PENDING_DEAN | APPROVED | REJECTED
 */
async function notifyStatusChange(proposal, previousStatus, newStatus) {
  const { id, eventName, clubLeadId } = proposal;
  const name = `"${eventName}"`;

  // Next approver: everyone with the role for the new stage.
  const nextRole = NEXT_APPROVER[newStatus];
  if (nextRole) {
    await notificationRepo.createForRole(
      nextRole,
      clip(`Proposal ${name} is waiting for your review.`),
      id
    );
  }

  // Club Lead: on every approval or rejection (not on their own submission).
  if (previousStatus && NEXT_APPROVER[previousStatus]) {
    const decidedBy = STAGE_LABEL[previousStatus];
    let message = null;
    if (newStatus === 'REJECTED') {
      message = `Your proposal ${name} was rejected by the ${decidedBy}.`;
    } else if (newStatus === 'APPROVED') {
      message = `Your proposal ${name} was approved by the ${decidedBy} and is now fully approved.`;
    } else if (NEXT_APPROVER[newStatus]) {
      message = `Your proposal ${name} was approved by the ${decidedBy} and is now with the ${STAGE_LABEL[newStatus]}.`;
    }
    if (message) {
      await notificationRepo.createForUser(clubLeadId, clip(message), id);
    }
  }
}

async function listForUser(userId) {
  const [items, unreadCount] = await Promise.all([
    notificationRepo.listForUser(userId),
    notificationRepo.countUnread(userId),
  ]);
  return {
    unreadCount,
    items: items.map((n) => ({
      id: n.id,
      proposalId: n.proposal_id,
      message: n.message,
      read: Boolean(n.is_read),
      createdAt: n.created_at,
    })),
  };
}

// Returns false when the notification does not exist or belongs to someone else.
async function markRead(id, userId) {
  return notificationRepo.markRead(id, userId);
}

async function markAllRead(userId) {
  await notificationRepo.markAllRead(userId);
}

module.exports = { notifyStatusChange, listForUser, markRead, markAllRead };
