// Same values as the `role` column on the server (db/schema.sql).
export const ROLES = {
  CLUB_LEAD: 'CLUB_LEAD',
  FACULTY: 'FACULTY',
  FINANCE: 'FINANCE',
  DEAN: 'DEAN',
  ADMIN: 'ADMIN',
  STUDENT: 'STUDENT',
};

export const ALL_ROLES = Object.values(ROLES);

export const ROLE_LABELS = {
  CLUB_LEAD: 'Club Lead',
  FACULTY: 'Faculty Coordinator',
  FINANCE: 'Finance Officer',
  DEAN: 'Dean',
  ADMIN: 'Campus Admin',
  STUDENT: 'Student',
};
