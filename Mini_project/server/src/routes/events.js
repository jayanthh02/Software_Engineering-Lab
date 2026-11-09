const express = require('express');
const eventService = require('../services/eventService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/events  ->  200 { items: [...] }  approved events from today onwards
// Any logged-in user may look; only students can register (POST /api/registrations/:id).
// 401 without a token.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const items = await eventService.listUpcoming(req.user);
    return res.status(200).json({ items });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
