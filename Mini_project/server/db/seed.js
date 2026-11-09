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

  // SCP-23: demo events, so the Events page has something to show.
  // Each one is an APPROVED proposal with its three approval decisions.
  // Dates are relative to today, so they always count as upcoming.
  const idOf = async (email) => {
    const [rows] = await pool.execute('SELECT id, club_id FROM users WHERE email = ?', [email]);
    return rows[0];
  };
  const approvers = {
    FACULTY: (await idOf('faculty@college.edu')).id,
    FINANCE: (await idOf('finance@college.edu')).id,
    DEAN: (await idOf('dean@college.edu')).id,
  };
  const demoEvents = [
    { lead: 'lead.a@college.edu', name: 'AI and You: Intro Talk', inDays: 7, venue: 'Main Auditorium', seats: 120, budget: 15000, description: 'An easy introduction to AI tools for every branch.' },
    { lead: 'lead.a@college.edu', name: '24h Campus Hackathon', inDays: 21, venue: 'CSE Block Labs', seats: 60, budget: 80000, description: 'Teams of up to four build a project in 24 hours.' },
    { lead: 'lead.b@college.edu', name: 'Line Follower Robot Race', inDays: 14, venue: 'Ground Floor Arena', seats: 40, budget: 20000, description: 'Bring your robot or build one at the workshop.' },
  ];

  let addedEvents = 0;
  for (const e of demoEvents) {
    const lead = await idOf(e.lead);
    const [exists] = await pool.execute(
      'SELECT id FROM proposals WHERE club_id = ? AND event_name = ?',
      [lead.club_id, e.name]
    );
    if (exists.length > 0) continue;

    const [result] = await pool.execute(
      `INSERT INTO proposals (club_id, club_lead_id, event_name, event_date, venue,
                              expected_attendance, budget, description, status)
       VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?, 'APPROVED')`,
      [lead.club_id, lead.id, e.name, e.inDays, e.venue, e.seats, e.budget, e.description]
    );
    for (const stage of ['FACULTY', 'FINANCE', 'DEAN']) {
      await pool.execute(
        `INSERT INTO approval_history (proposal_id, stage, approver_id, decision, comment)
         VALUES (?, ?, ?, 'APPROVE', 'Approved (demo data)')`,
        [result.insertId, stage, approvers[stage]]
      );
    }
    addedEvents += 1;
  }

  console.log(`Seeded ${clubs.length} clubs, ${users.length} users and ${addedEvents} new demo events`);
  await pool.end();
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
