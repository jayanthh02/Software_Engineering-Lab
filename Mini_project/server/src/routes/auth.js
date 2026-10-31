const express = require('express');
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login  { email, password }  ->  200 { token, user }
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res
        .status(400)
        .json({ error: 'VALIDATION_ERROR', message: 'Email and password are required' });
    }

    const result = await authService.login(email, password);
    if (!result) {
      // Same message for unknown email and wrong password, and no token issued.
      return res
        .status(401)
        .json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/logout  ->  200
// JWTs are stateless: the client discards the token. We only confirm
// the caller was logged in.
router.post('/logout', authenticate, (req, res) => {
  res.status(200).json({ message: 'Logged out' });
});

// GET /api/auth/me  ->  200 { user }   (any logged-in role)
// The client can call this to confirm who the token belongs to.
router.get('/me', authenticate, (req, res) => {
  res.status(200).json({ user: req.user });
});

module.exports = router;
