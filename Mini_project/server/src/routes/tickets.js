const express = require('express');
const myTicketService = require('../services/myTicketService');
const { protect } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Only students register for events, so only students have tickets.
router.use(...protect(ROLES.STUDENT));

// GET /api/tickets  ->  200 { items: [...] }  (the logged-in student's own tickets)
router.get('/', async (req, res, next) => {
  try {
    const items = await myTicketService.listMine(req.user.id);
    return res.status(200).json({ items });
  } catch (error) {
    return next(error);
  }
});

// GET /api/tickets/:id/qr  ->  200 image/png download | 400 bad id | 404 not found or not yours
router.get('/:id/qr', async (req, res, next) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid ticket ID',
    });
  }

  try {
    const { png, filename } = await myTicketService.getQrPng(id, req.user.id);

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'private, no-store');
    res.attachment(filename); // Content-Disposition: attachment; filename="ticket-<id>.png"
    return res.status(200).send(png);
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
