const jwt = require('jsonwebtoken');
const config = require('../config');

// Verifies the JWT in "Authorization: Bearer <token>" (SCP-SR-002).
// Missing, malformed or expired token -> 401.
// SCP-9 will add requireRole(...) in this file for the 403 checks.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Login required' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, role: payload.role, clubId: payload.clubId };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
