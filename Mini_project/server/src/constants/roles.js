// Exact values stored in users.role (db/schema.sql) and in the JWT.
// Use these instead of typing strings:  requireRole(ROLES.FACULTY)
const ROLES = Object.freeze({
  CLUB_LEAD: 'CLUB_LEAD',
  FACULTY: 'FACULTY',
  FINANCE: 'FINANCE',
  DEAN: 'DEAN',
  ADMIN: 'ADMIN',
  STUDENT: 'STUDENT',
});

// The three approver roles (SCP-F-006 / SCP-F-007).
const APPROVER_ROLES = Object.freeze([ROLES.FACULTY, ROLES.FINANCE, ROLES.DEAN]);

module.exports = { ROLES, APPROVER_ROLES };
