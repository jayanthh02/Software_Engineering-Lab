const express = require('express');
const notificationService = require('../services/notificationService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Every role has notifications, so only login is required (no role check).
router.use(authenticate);

// GET /api/notifications  ->  200 { unreadCount, items: [...] }  (newest 50, own only)
router.get('/', async (req, res, next) => {
  try {
    const result = await notificationService.listForUser(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/notifications/:id/read  ->  200 | 400 bad id | 404 not found or not yours
router.patch('/:id/read', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid notification id' });
    }

    const updated = await notificationService.markRead(id, req.user.id);
    if (!updated) {
      // Same answer for "does not exist" and "belongs to another user".
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found' });
    }
    return res.status(200).json({ message: 'Marked as read' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/notifications/read-all  ->  200
router.post('/read-all', async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.user.id);
    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
