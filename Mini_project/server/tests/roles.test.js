const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../src/repositories/userRepo'); // no database in these tests
const app = require('../src/app');
const { authenticate, requireRole, protect } = require('../src/middleware/auth');
const { ROLES, APPROVER_ROLES } = require('../src/constants/roles');

// Token for any role, signed like the real login does.
const tokenFor = (role, extra = {}) =>
  jwt.sign({ sub: 1, role, clubId: 1, ...extra }, process.env.JWT_SECRET, { expiresIn: '8h' });
const bearer = (role) => ({ Authorization: `Bearer ${tokenFor(role)}` });

// A small test-only app that mimics the real endpoints the other stories will build.
// When SCP-13/14 add the real decision route, it uses the same middleware.
function buildTestApp() {
  const t = express();
  t.use(express.json());
  t.post('/api/proposals', protect(ROLES.CLUB_LEAD), (req, res) => res.status(201).json({ ok: true }));
  t.post('/api/proposals/:id/decision', authenticate, requireRole(...APPROVER_ROLES), (req, res) =>
    res.status(200).json({ ok: true })
  );
  t.get('/api/events', authenticate, (req, res) => res.status(200).json({ ok: true })); // any role
  return t;
}

describe('TC-AUTH-02 role-based access control (SCP-F-002)', () => {
  const t = buildTestApp();

  test('a Student calling the decision endpoint gets 403', async () => {
    const res = await request(t).post('/api/proposals/1/decision').set(bearer(ROLES.STUDENT)).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  test.each(APPROVER_ROLES)('%s can call the decision endpoint', async (role) => {
    const res = await request(t).post('/api/proposals/1/decision').set(bearer(role)).send({});
    expect(res.status).toBe(200);
  });

  test.each([ROLES.STUDENT, ROLES.FACULTY, ROLES.FINANCE, ROLES.DEAN, ROLES.ADMIN])(
    '%s cannot submit a proposal (Club Lead only)',
    async (role) => {
      const res = await request(t).post('/api/proposals').set(bearer(role)).send({});
      expect(res.status).toBe(403);
    }
  );

  test('a Club Lead can submit a proposal', async () => {
    const res = await request(t).post('/api/proposals').set(bearer(ROLES.CLUB_LEAD)).send({});
    expect(res.status).toBe(201);
  });

  test('a Club Lead cannot approve a proposal', async () => {
    const res = await request(t).post('/api/proposals/1/decision').set(bearer(ROLES.CLUB_LEAD)).send({});
    expect(res.status).toBe(403);
  });

  test.each(Object.values(ROLES))('an endpoint with no role limit lets %s in', async (role) => {
    const res = await request(t).get('/api/events').set(bearer(role));
    expect(res.status).toBe(200);
  });

  test('a token with an unknown role is rejected with 403', async () => {
    const res = await request(t)
      .post('/api/proposals/1/decision')
      .set({ Authorization: `Bearer ${tokenFor('HACKER')}` })
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('TC-SEC-02 token and role checks (SCP-SR-002)', () => {
  const t = buildTestApp();

  test('no token returns 401, not 403', async () => {
    const res = await request(t).post('/api/proposals/1/decision').send({});
    expect(res.status).toBe(401);
  });

  test('an expired token returns 401', async () => {
    const expired = jwt.sign({ sub: 1, role: ROLES.DEAN }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(t)
      .post('/api/proposals/1/decision')
      .set({ Authorization: `Bearer ${expired}` })
      .send({});
    expect(res.status).toBe(401);
  });

  test('a token signed with another secret returns 401', async () => {
    const forged = jwt.sign({ sub: 1, role: ROLES.DEAN }, 'some-other-secret');
    const res = await request(t)
      .post('/api/proposals/1/decision')
      .set({ Authorization: `Bearer ${forged}` })
      .send({});
    expect(res.status).toBe(401);
  });

  test('requireRole without authenticate in front returns 401', async () => {
    const lone = express();
    lone.get('/x', requireRole(ROLES.ADMIN), (req, res) => res.sendStatus(200));
    const res = await request(lone).get('/x');
    expect(res.status).toBe(401);
  });
});

describe('requireRole setup checks', () => {
  test('throws on an empty list or a misspelled role', () => {
    expect(() => requireRole()).toThrow();
    expect(() => requireRole('FACULTY ')).toThrow();
    expect(() => requireRole('Faculty')).toThrow();
  });
});

describe('GET /api/auth/me on the real app', () => {
  test('returns the logged-in user for any role', async () => {
    const res = await request(app).get('/api/auth/me').set(bearer(ROLES.STUDENT));
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('STUDENT');
  });

  test('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
