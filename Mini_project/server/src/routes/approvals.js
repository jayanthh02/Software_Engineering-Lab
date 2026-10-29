const express = require('express');
const approvalService = require('../services/approvalService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const MAX_COMMENT = 500; // approval_history.comment column size

// Only Faculty Coordinator, Finance Officer and Dean may use these routes (-> 403).
function requireApprover(req, res, next) {
  if (!approvalService.isApprover(req.user.role)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only approvers can do this' });
  }
  return next();
}

// GET /api/approvals/inbox  ->  200 [ proposals waiting at the caller's stage ]
router.get('/approvals/inbox', authenticate, requireApprover, async (req, res, next) => {
  try {
    const items = await approvalService.inbox(req.user.role);
    return res.status(200).json(items);
  } catch (err) {
    return next(err);
  }
});
// GET /api/proposals/:id/history
router.get('/proposals/:id/history', authenticate, requireApprover, async (req, res, next) => {
  try {
    const proposalId = Number(req.params.id);

    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid proposal id',
      });
    }

    const history = await approvalService.getApprovalHistory(proposalId, req.user);
    return res.status(200).json(history);
  } catch (err) {
    if (err instanceof approvalService.ApprovalError) {
      return res.status(err.status).json({
        error: err.code,
        message: err.message,
      });
    }
    return next(err);
  }
});
// POST /api/proposals/:id/decision  { decision: "APPROVE" | "REJECT", comment }
//   ->  200 { proposalId, newStatus }
//   400 invalid input / comment required on reject, 403 wrong role or not current stage,
//   404 proposal not found, 409 already decided
router.post('/proposals/:id/decision', authenticate, requireApprover, async (req, res, next) => {
  try {
    const proposalId = Number(req.params.id);
    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid proposal id' });
    }

    const { decision, comment } = req.body || {};
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return res
        .status(400)
        .json({ error: 'VALIDATION_ERROR', message: 'Decision must be APPROVE or REJECT' });
    }
    if (comment !== undefined && comment !== null && typeof comment !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Comment must be text' });
    }

    const text = (comment || '').trim();
    if (decision === 'REJECT' && !text) {
      return res
        .status(400)
        .json({ error: 'COMMENT_REQUIRED', message: 'A comment is required to reject a proposal' });
    }
    if (text.length > MAX_COMMENT) {
      return res
        .status(400)
        .json({ error: 'VALIDATION_ERROR', message: `Comment must be at most ${MAX_COMMENT} characters` });
    }

    const result = await approvalService.decide({
      proposalId,
      decision,
      comment: text,
      user: req.user,
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof approvalService.ApprovalError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    return next(err);
  }
});

module.exports = router;
