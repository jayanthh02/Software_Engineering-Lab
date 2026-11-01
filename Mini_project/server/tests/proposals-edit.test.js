const request = require('supertest');
const jwt = require('jsonwebtoken');

// No real database: both repositories are mocked. The real notification
// service runs, so we can check who gets notified.
jest.mock('../src/repositories/proposalRepo');
jest.mock('../src/repositories/notificationRepo');
const proposalRepo = require('../src/repositories/proposalRepo');
const notificationRepo = require('../src/repositories/notificationRepo');
const app = require('../src/app');

function token(role, extra = {}) {
  return `Bearer ${jwt.sign({ sub: 1, role, clubId: 2, ...extra }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}

function futureDate(days = 30) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function validBody(overrides = {}) {
  return {
    eventName: 'AI Workshop (revised)',
    eventDate: futureDate(),
    venue: 'Seminar Hall',
    expectedAttendance: 100,
    budget: 18000,
    description: 'Revised plan with a lower budget.',
    ...overrides,
  };
}

function proposal(status, overrides = {}) {
  return { id: 42, club_id: 2, club_lead_id: 1, event_name: 'AI Workshop', status, ...overrides };
}

function resubmit(body, { auth = token('CLUB_LEAD'), id = 42 } = {}) {
  const req = request(app).put(`/api/proposals/${id}`);
  return (auth ? req.set('Authorization', auth) : req).send(body);
}

beforeEach(() => {
  jest.resetAllMocks();
  proposalRepo.findById.mockResolvedValue(proposal('REJECTED'));
  proposalRepo.resubmit.mockResolvedValue(true);
  notificationRepo.createForRole.mockResolvedValue();
});

describe('TC-PROP-02 edit and resubmit a rejected proposal (SCP-F-004)', () => {
  test('rejected proposal, edited budget -> 200, status returns to PENDING_FACULTY', async () => {
    const res = await resubmit(validBody({ budget: 18000 }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ proposalId: 42, status: 'PENDING_FACULTY' });
    expect(proposalRepo.resubmit).toHaveBeenCalledWith(42, expect.objectContaining({ budget: 18000 }));
  });

  test('history is kept: only the proposals row is updated, nothing is deleted', async () => {
    await resubmit(validBody());
    // proposalRepo has no delete function and resubmit is the only write.
    expect(Object.keys(proposalRepo).sort()).toEqual(['create', 'findById', 'listByClub', 'resubmit']);
    expect(proposalRepo.resubmit).toHaveBeenCalledTimes(1);
  });

  test('Faculty Coordinators are notified again; the Club Lead is not', async () => {
    await resubmit(validBody());
    expect(notificationRepo.createForRole).toHaveBeenCalledWith('FACULTY', expect.stringContaining('AI Workshop'), 42);
    expect(notificationRepo.createForUser).not.toHaveBeenCalled();
  });

  test('a notification failure does not turn a saved resubmit into an error', async () => {
    notificationRepo.createForRole.mockRejectedValue(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await resubmit(validBody());

    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  test('same field rules as submit: empty budget -> 400 with a field error, nothing saved', async () => {
    const res = await resubmit(validBody({ budget: '' }));

    expect(res.status).toBe(400);
    expect(res.body.fields.budget).toBeDefined();
    expect(proposalRepo.resubmit).not.toHaveBeenCalled();
  });

  test('client cannot change the status or club through the body', async () => {
    await resubmit(validBody({ status: 'APPROVED', clubId: 99, club_id: 99 }));
    const saved = proposalRepo.resubmit.mock.calls[0][1];
    expect(saved).not.toHaveProperty('status');
    expect(saved).not.toHaveProperty('clubId');
  });
});

describe('only rejected proposals are editable (approved proposals are read-only)', () => {
  test.each(['PENDING_FACULTY', 'PENDING_FINANCE', 'PENDING_DEAN', 'APPROVED'])(
    '%s -> 409 NOT_EDITABLE and nothing changes',
    async (status) => {
      proposalRepo.findById.mockResolvedValue(proposal(status));

      const res = await resubmit(validBody());

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('NOT_EDITABLE');
      expect(proposalRepo.resubmit).not.toHaveBeenCalled();
    }
  );

  test('status changed between the check and the update -> 409', async () => {
    proposalRepo.resubmit.mockResolvedValue(false);
    const res = await resubmit(validBody());
    expect(res.status).toBe(409);
    expect(notificationRepo.createForRole).not.toHaveBeenCalled();
  });
});

describe('access rules for PUT /api/proposals/:id', () => {
  test('no token -> 401', async () => {
    const res = await resubmit(validBody(), { auth: null });
    expect(res.status).toBe(401);
  });

  test.each(['STUDENT', 'FACULTY', 'FINANCE', 'DEAN', 'ADMIN'])('%s -> 403', async (role) => {
    const res = await resubmit(validBody(), { auth: token(role) });
    expect(res.status).toBe(403);
    expect(proposalRepo.resubmit).not.toHaveBeenCalled();
  });

  test("another club's proposal -> 403 and nothing changes", async () => {
    proposalRepo.findById.mockResolvedValue(proposal('REJECTED', { club_id: 3 }));
    const res = await resubmit(validBody());
    expect(res.status).toBe(403);
    expect(proposalRepo.resubmit).not.toHaveBeenCalled();
  });

  test('unknown proposal -> 404', async () => {
    proposalRepo.findById.mockResolvedValue(null);
    const res = await resubmit(validBody());
    expect(res.status).toBe(404);
  });

  test.each(['abc', '0', '-4', '1.5'])('bad id %s -> 400', async (id) => {
    const res = await resubmit(validBody(), { id });
    expect(res.status).toBe(400);
    expect(proposalRepo.findById).not.toHaveBeenCalled();
  });

  test('Club Lead whose account has no club -> 403 NO_CLUB', async () => {
    const res = await resubmit(validBody(), { auth: token('CLUB_LEAD', { clubId: null }) });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NO_CLUB');
  });
});

describe('GET /api/proposals/mine (used by the Edit page)', () => {
  const row = {
    id: 42,
    event_name: 'AI Workshop',
    event_date: '2026-12-01',
    venue: 'Hall',
    expected_attendance: 100,
    budget: '25000.00',
    description: 'x',
    status: 'REJECTED',
    rejection_comment: 'Budget too high',
  };

  test('returns the caller\'s club proposals with the rejection comment', async () => {
    proposalRepo.listByClub.mockResolvedValue([row]);

    const res = await request(app).get('/api/proposals/mine?status=REJECTED').set('Authorization', token('CLUB_LEAD'));

    expect(res.status).toBe(200);
    expect(proposalRepo.listByClub).toHaveBeenCalledWith(2, 'REJECTED');
    expect(res.body[0]).toMatchObject({ id: 42, budget: 25000, status: 'REJECTED', rejectionComment: 'Budget too high' });
  });

  test('unknown status filter -> 400; other roles -> 403; no token -> 401', async () => {
    const bad = await request(app).get('/api/proposals/mine?status=NOPE').set('Authorization', token('CLUB_LEAD'));
    const wrongRole = await request(app).get('/api/proposals/mine').set('Authorization', token('STUDENT'));
    const anon = await request(app).get('/api/proposals/mine');

    expect(bad.status).toBe(400);
    expect(wrongRole.status).toBe(403);
    expect(anon.status).toBe(401);
    expect(proposalRepo.listByClub).not.toHaveBeenCalled();
  });
});
