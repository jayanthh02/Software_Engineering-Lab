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

module.exports = router;
