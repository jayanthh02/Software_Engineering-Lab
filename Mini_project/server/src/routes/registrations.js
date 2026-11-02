
const express = require('express');
const registrationService = require('../services/registrationService');
const { protect } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// POST /api/registrations/:proposalId
// Students can register only for approved events.
router.post('/:proposalId', protect(ROLES.STUDENT), async (req, res, next) => {
  const proposalId = Number(req.params.proposalId);

  if (!Number.isInteger(proposalId) || proposalId <= 0) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid event proposal ID',
    });
  }

  try {
    const result = await registrationService.register(proposalId, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    if (error.status && error.code) {
      return res.status(error.status).json({
        error: error.code,
        message: error.message,
      });
    }

    return next(error);
  }
});

module.exports = router;
