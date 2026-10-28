// Usage: npm run seed
// Loads test clubs and one user per role. Safe to run more than once.
// All seeded users share the password below (demo/test data only).
const bcrypt = require('bcrypt');
const pool = require('../src/db');

const PASSWORD = 'Test@123';

const clubs = ['Coding Club', 'Robotics Club', 'Cultural Club'];

const users = [
  { name: 'Club Lead A', email: 'lead.a@college.edu', role: 'CLUB_LEAD', club: 'Coding Club' },
  { name: 'Club Lead B', email: 'lead.b@college.edu', role: 'CLUB_LEAD', club: 'Robotics Club' },
  { name: 'Faculty Coordinator', email: 'faculty@college.edu', role: 'FACULTY' },
  { name: 'Finance Officer', email: 'finance@college.edu', role: 'FINANCE' },
  { name: 'Dean', email: 'dean@college.edu', role: 'DEAN' },
  { name: 'Campus Admin', email: 'admin@college.edu', role: 'ADMIN' },
  { name: 'Student One', email: 'student1@college.edu', role: 'STUDENT' },
  { name: 'Student Two', email: 'student2@college.edu', role: 'STUDENT' },
];

(async () => {
  for (const name of clubs) {
    await pool.execute('INSERT IGNORE INTO clubs (name) VALUES (?)', [name]);
  }

  const hash = await bcrypt.hash(PASSWORD, 10); // salted bcrypt (SCP-SR-001)

  for (const u of users) {
    let clubId = null;
    if (u.club) {
      const [rows] = await pool.execute('SELECT id FROM clubs WHERE name = ?', [u.club]);
      clubId = rows[0].id;
    }
    await pool.execute(
      'INSERT IGNORE INTO users (name, email, password_hash, role, club_id) VALUES (?, ?, ?, ?, ?)',
      [u.name, u.email, hash, u.role, clubId]
    );
  }

  console.log(`Seeded ${clubs.length} clubs and ${users.length} users`);
  await pool.end();
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
