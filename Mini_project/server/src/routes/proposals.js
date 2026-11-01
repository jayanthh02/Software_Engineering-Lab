const express = require('express');
const proposalService = require('../services/proposalService');
const { protect } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// POST /api/proposals
//   { eventName, eventDate, venue, expectedAttendance, budget, description }
//   ->  201 { proposalId, status: "PENDING_FACULTY" }
//   400 { error: "VALIDATION_ERROR", message, fields: { budget: "..." } }
//   401 not logged in, 403 not a Club Lead
router.post('/', protect(ROLES.CLUB_LEAD), async (req, res, next) => {
  try {
    const result = await proposalService.submit(req.body, req.user);
    return res.status(201).json(result);
  } catch (err) {
    if (err instanceof proposalService.ProposalError) {
      const body = { error: err.code, message: err.message };
      if (err.fields) body.fields = err.fields;
      return res.status(err.status).json(body);
    }
    return next(err);
  }
});

const STATUSES = ['PENDING_FACULTY', 'PENDING_FINANCE', 'PENDING_DEAN', 'APPROVED', 'REJECTED'];

function sendError(err, res, next) {
  if (err instanceof proposalService.ProposalError) {
    const body = { error: err.code, message: err.message };
    if (err.fields) body.fields = err.fields;
    return res.status(err.status).json(body);
  }
  return next(err);
}

// GET /api/proposals/mine[?status=REJECTED]  ->  200 [ proposals of the caller's club ]
// (declared before /:id so "mine" is not read as an id)
router.get('/mine', protect(ROLES.CLUB_LEAD), async (req, res, next) => {
  try {
    const { status } = req.query;
    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Unknown status filter' });
    }
    return res.status(200).json(await proposalService.listMine(req.user, status));
  } catch (err) {
    return sendError(err, res, next);
  }
});

// PUT /api/proposals/:id   same body as POST  ->  200 { proposalId, status: "PENDING_FACULTY" }
//   400 field errors / bad id, 401, 403 not a Club Lead or another club's proposal,
//   404 not found, 409 proposal is not REJECTED (approved / in review = read-only)
router.put('/:id', protect(ROLES.CLUB_LEAD), async (req, res, next) => {
  try {
    const proposalId = Number(req.params.id);
    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid proposal id' });
    }
    return res.status(200).json(await proposalService.resubmit(proposalId, req.body, req.user));
  } catch (err) {
    return sendError(err, res, next);
  }
});

module.exports = router;
