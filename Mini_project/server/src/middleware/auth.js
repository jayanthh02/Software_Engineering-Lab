const jwt = require('jsonwebtoken');
const config = require('../config');
const { ROLES } = require('../constants/roles');

const VALID_ROLES = Object.values(ROLES);

// Step 1 (SCP-SR-002): verifies the JWT in "Authorization: Bearer <token>".
// Missing, malformed or expired token -> 401.
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

// Step 2 (SCP-F-002): allows the request only if the user's role is in the list.
// Wrong role -> 403. Always put it AFTER authenticate.
//
//   router.post('/:id/decision', authenticate, requireRole(ROLES.FACULTY, ROLES.FINANCE, ROLES.DEAN), handler)
//
// or use the shortcut:  router.post('/', protect(ROLES.CLUB_LEAD), handler)
function requireRole(...allowedRoles) {
  // Catch typos like requireRole('FACULTY ') at startup, not in production.
  const bad = allowedRoles.filter((r) => !VALID_ROLES.includes(r));
  if (allowedRoles.length === 0 || bad.length > 0) {
    throw new Error(`requireRole: invalid role list [${allowedRoles.join(', ')}]`);
  }

  return (req, res, next) => {
    if (!req.user) {
      // requireRole was used without authenticate in front of it.
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Login required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: 'FORBIDDEN', message: 'Your role is not allowed to do this' });
    }
    return next();
  };
}

// Shortcut: login check + role check in one.
function protect(...allowedRoles) {
  return [authenticate, requireRole(...allowedRoles)];
}

module.exports = { authenticate, requireRole, protect };
