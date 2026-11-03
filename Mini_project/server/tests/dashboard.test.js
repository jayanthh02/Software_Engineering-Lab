const request = require('supertest');
const jwt = require('jsonwebtoken');

// No real database: the repository is mocked; the real service and route run.
jest.mock('../src/repositories/dashboardRepo');
const dashboardRepo = require('../src/repositories/dashboardRepo');
const app = require('../src/app');

function token(role, clubId = null) {
  return `Bearer ${jwt.sign({ sub: 9, role, clubId }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}
const ADMIN = token('ADMIN');
const LEAD_A = token('CLUB_LEAD', 1);

function get(query = '', auth = ADMIN) {
  const req = request(app).get(`/api/dashboard${query}`);
  return auth ? req.set('Authorization', auth) : req;
}

const NO_FILTER = { clubId: null, status: null, from: null, to: null };

beforeEach(() => {
  jest.resetAllMocks();
  dashboardRepo.pipeline.mockResolvedValue([
    { status: 'PENDING_FACULTY', count: 5, budget: '100000.00' },
    { status: 'PENDING_FINANCE', count: 3, budget: '60000.00' },
    { status: 'PENDING_DEAN', count: 2, budget: '40000.00' },
    { status: 'APPROVED', count: 12, budget: '850000.00' },
  ]);
  dashboardRepo.listProposals.mockResolvedValue([
    {
      id: 1024,
      event_name: 'AI Talk',
      club_name: 'Coding Club',
      event_date: '2026-11-15',
      budget: '50000.00',
      status: 'PENDING_FINANCE',
      created_at: '2026-11-05T10:00:00Z',
      days_in_status: 10,
    },
    {
      id: 1001,
      event_name: 'Robo Race',
      club_name: 'Robotics Club',
      event_date: '2026-11-20',
      budget: '30000.00',
      status: 'APPROVED',
      created_at: '2026-10-20T10:00:00Z',
      days_in_status: 4,
    },
  ]);
  dashboardRepo.listClubs.mockResolvedValue([
    { id: 1, name: 'Coding Club' },
    { id: 2, name: 'Robotics Club' },
  ]);
});

describe('TC-DASH-01 dashboard counts and filters (SCP-F-014)', () => {
  test('pipeline counts match the database, with zero for empty stages', async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body.pipeline).toEqual({
      PENDING_FACULTY: 5,
      PENDING_FINANCE: 3,
      PENDING_DEAN: 2,
      APPROVED: 12,
      REJECTED: 0,
    });
    expect(res.body.totals).toEqual({ proposals: 22, pendingBudget: 200000, approvedBudget: 850000 });
  });

  test('proposal table rows: days pending only for proposals still in review', async () => {
    const res = await get();

    expect(res.body.proposals[0]).toEqual({
      id: 1024,
      eventName: 'AI Talk',
      clubName: 'Coding Club',
      eventDate: '2026-11-15',
      budget: 50000,
      status: 'PENDING_FINANCE',
      submittedAt: '2026-11-05T10:00:00Z',
      daysPending: 10,
    });
    expect(res.body.proposals[1].daysPending).toBeNull();
  });

  test('Status = Pending Finance and a date range filter the table; counts ignore the status filter', async () => {
    const res = await get('?status=PENDING_FINANCE&from=2026-10-29&to=2026-11-05');

    expect(res.status).toBe(200);
    expect(dashboardRepo.listProposals).toHaveBeenCalledWith({
      clubId: null,
      status: 'PENDING_FINANCE',
      from: '2026-10-29',
      to: '2026-11-05',
    });
    expect(dashboardRepo.pipeline).toHaveBeenCalledWith({ clubId: null, from: '2026-10-29', to: '2026-11-05' });
  });

  test('Admin can filter by club and gets the club list for the filter', async () => {
    const res = await get('?clubId=2');

    expect(dashboardRepo.listProposals).toHaveBeenCalledWith({ ...NO_FILTER, clubId: 2 });
    expect(res.body.clubs).toEqual([
      { id: 1, name: 'Coding Club' },
      { id: 2, name: 'Robotics Club' },
    ]);
  });

  test('empty filter values are treated as no filter', async () => {
    await get('?status=&clubId=&from=&to=');
    expect(dashboardRepo.listProposals).toHaveBeenCalledWith(NO_FILTER);
  });

  test('Club Lead sees only their own club, even with no club filter', async () => {
    const res = await get('', LEAD_A);

    expect(res.status).toBe(200);
    expect(dashboardRepo.listProposals).toHaveBeenCalledWith({ ...NO_FILTER, clubId: 1 });
    expect(dashboardRepo.pipeline).toHaveBeenCalledWith({ clubId: 1, from: null, to: null });
    expect(dashboardRepo.listClubs).not.toHaveBeenCalled();
    expect(res.body.clubs).toEqual([]);
  });

  test('Club Lead asking for another club gets 403 and no data is read', async () => {
    const res = await get('?clubId=2', LEAD_A);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
    expect(dashboardRepo.listProposals).not.toHaveBeenCalled();
  });

  test('Club Lead asking for their own club id is allowed', async () => {
    const res = await get('?clubId=1', LEAD_A);
    expect(res.status).toBe(200);
  });

  test.each([
    ['?status=DONE', 'Unknown status filter'],
    ['?clubId=abc', 'Invalid club id'],
    ['?clubId=0', 'Invalid club id'],
    ['?from=31-10-2026', 'From date must be YYYY-MM-DD'],
    ['?to=2026-02-30', 'To date must be YYYY-MM-DD'],
    ['?from=2026-11-05&to=2026-11-01', 'From date must be on or before the To date'],
  ])('invalid filter %s returns 400', async (query, message) => {
    const res = await get(query);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'VALIDATION_ERROR', message });
    expect(dashboardRepo.listProposals).not.toHaveBeenCalled();
  });

  test('injection text in a filter is rejected, not passed to SQL', async () => {
    const res = await get(`?status=${encodeURIComponent("APPROVED' OR 1=1 --")}`);
    expect(res.status).toBe(400);
    expect(dashboardRepo.pipeline).not.toHaveBeenCalled();
  });

  test('a database error returns 500 JSON without a stack trace', async () => {
    dashboardRepo.pipeline.mockRejectedValue(new Error('db down'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await get();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'SERVER_ERROR', message: 'Something went wrong' });
    errSpy.mockRestore();
  });
});

describe('TC-AUTH-02 / TC-SEC-02 role and token checks (SCP-F-002, SCP-SR-002)', () => {
  test.each(['STUDENT', 'FACULTY', 'FINANCE', 'DEAN'])('%s gets 403', async (role) => {
    const res = await get('', token(role));
    expect(res.status).toBe(403);
    expect(dashboardRepo.pipeline).not.toHaveBeenCalled();
  });

  test('no token returns 401', async () => {
    const res = await get('', null);
    expect(res.status).toBe(401);
  });
});
