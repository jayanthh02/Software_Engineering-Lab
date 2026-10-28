const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepo = require('../repositories/userRepo');

// Used when the email is unknown, so an unknown email and a wrong password
// take about the same time and give the same answer.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

/**
 * Check credentials and issue a JWT (SCP-F-001).
 * Returns { token, user } on success, or null for bad credentials.
 */
async function login(email, password) {
  const user = await userRepo.findByEmail(email.trim().toLowerCase());
  const hash = user ? user.password_hash : DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) return null;

  const token = jwt.sign(
    { sub: user.id, role: user.role, clubId: user.club_id },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return {
    token,
    user: { id: user.id, name: user.name, role: user.role, clubId: user.club_id },
  };
}

module.exports = { login };
