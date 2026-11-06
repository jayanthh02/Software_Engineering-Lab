const express = require('express');
const checkinService = require('../services/checkinService');
const { protect } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

const MAX_TOKEN_LENGTH = 300; // a real QR token is about 110 characters

// POST /api/tickets/checkin   { token }
//   token = the scanned QR text, or the ticket code typed by hand (manual fallback)
//   ->  200 { valid: true, studentName, eventName }   (the ticket is now USED)
//   400 VALIDATION_ERROR no token | 400 INVALID_TICKET "Invalid"
//   401 not logged in, 403 not a Club Lead | 403 WRONG_EVENT "Wrong event"
//   409 ALREADY_USED "Already used"
router.post('/', protect(ROLES.CLUB_LEAD), async (req, res, next) => {
  const { token } = req.body || {};

  if (typeof token !== 'string' || token.trim() === '' || token.length > MAX_TOKEN_LENGTH) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'A ticket token is required',
    });
  }

  try {
    const result = await checkinService.validate(token, req.user);
    return res.status(200).json(result);
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
