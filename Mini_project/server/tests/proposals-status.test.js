const request = require('supertest');
const jwt = require('jsonwebtoken');

// No real database: the repository is mocked, so the real service decides what
// each status shows and which club's proposals are asked for.
jest.mock('../src/repositories/proposalRepo');
jest.mock('../src/repositories/notificationRepo');
const proposalRepo = require('../src/repositories/proposalRepo');
const app = require('../src/app');

function token(role, extra = {}) {
  return `Bearer ${jwt.sign({ sub: 1, role, clubId: 1, ...extra }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}

function row(id, status, overrides = {}) {
  return {
    id,
    club_id: 1,
    event_name: `Event ${id}`,
    event_date: '2026-12-01',
    venue: 'Main Hall',
    expected_attendance: 100,
    budget: '25000.00',
    description: 'desc',
    status,
    created_at: '2026-11-01T05:00:00.000Z',
    updated_at: '2026-11-01T06:00:00.000Z',
    rejection_comment: null,
    rejection_stage: null,
    ...overrides,
  };
}

function mine(query = '', auth = token('CLUB_LEAD')) {
  const req = request(app).get(`/api/proposals/mine${query}`);
  return auth ? req.set('Authorization', auth) : req;
}

beforeEach(() => {
  jest.resetAllMocks();
  proposalRepo.listByClub.mockResolvedValue([]);
});

describe('TC-PROP-03 Club Lead views own proposal status (SCP-F-005)', () => {
  test('only the Club Lead\'s own club is requested (Club A)', async () => {
    proposalRepo.listByClub.mockResolvedValue([row(1, 'PENDING_FACULTY')]);

    const res = await mine('', token('CLUB_LEAD', { clubId: 1 }));

    expect(res.status).toBe(200);
    expect(proposalRepo.listByClub).toHaveBeenCalledWith(1, undefined);
  });

  test('a Club Lead from another club (Club B) is asked for Club B only', async () => {
    await mine('', token('CLUB_LEAD', { clubId: 2 }));
    expect(proposalRepo.listByClub).toHaveBeenCalledWith(2, undefined);
    expect(proposalRepo.listByClub).not.toHaveBeenCalledWith(1, expect.anything());
  });

  test.each([
    ['PENDING_FACULTY', 'Pending Faculty', 'Faculty Coordinator'],
    ['PENDING_FINANCE', 'Pending Finance', 'Finance Officer'],
    ['PENDING_DEAN', 'Pending Dean', 'Dean'],
    ['APPROVED', 'Approved', null],
    ['REJECTED', 'Rejected', null],
  ])('%s shows label "%s" and stage %p', async (status, label, stage) => {
    proposalRepo.listByClub.mockResolvedValue([row(7, status)]);

    const res = await mine();

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 7, status, statusLabel: label, currentStage: stage });
  });

  test('the list keeps the order given by the repository and shows every proposal', async () => {
    proposalRepo.listByClub.mockResolvedValue([
      row(3, 'APPROVED'),
      row(2, 'PENDING_DEAN'),
      row(1, 'REJECTED'),
    ]);

    const res = await mine();

    expect(res.body.map((p) => p.id)).toEqual([3, 2, 1]);
  });

  test('a rejected proposal shows the comment and who rejected it', async () => {
    proposalRepo.listByClub.mockResolvedValue([
      row(5, 'REJECTED', { rejection_comment: 'Budget too high', rejection_stage: 'FINANCE' }),
    ]);

    const res = await mine();

    expect(res.body[0]).toMatchObject({ rejectionComment: 'Budget too high', rejectedBy: 'Finance Officer' });
  });

  test('a proposal that was never rejected has no rejection details', async () => {
    proposalRepo.listByClub.mockResolvedValue([row(6, 'PENDING_FINANCE')]);

    const res = await mine();

    expect(res.body[0].rejectionComment).toBeNull();
    expect(res.body[0].rejectedBy).toBeNull();
  });

  test('budget is a number and dates are plain strings', async () => {
    proposalRepo.listByClub.mockResolvedValue([row(8, 'APPROVED', { budget: '18000.50' })]);

    const res = await mine();

    expect(res.body[0].budget).toBe(18000.5);
    expect(res.body[0].eventDate).toBe('2026-12-01');
  });

  test('no proposals yet -> 200 with an empty list', async () => {
    const res = await mine();
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('status filter is passed on to the repository', async () => {
    await mine('?status=APPROVED');
    expect(proposalRepo.listByClub).toHaveBeenCalledWith(1, 'APPROVED');
  });
});

describe('access rules for GET /api/proposals/mine', () => {
  test('no token -> 401', async () => {
    const res = await mine('', null);
    expect(res.status).toBe(401);
    expect(proposalRepo.listByClub).not.toHaveBeenCalled();
  });

  test.each(['STUDENT', 'FACULTY', 'FINANCE', 'DEAN', 'ADMIN'])('%s -> 403', async (role) => {
    const res = await mine('', token(role));
    expect(res.status).toBe(403);
    expect(proposalRepo.listByClub).not.toHaveBeenCalled();
  });

  test('Club Lead whose account has no club -> 403 NO_CLUB', async () => {
    const res = await mine('', token('CLUB_LEAD', { clubId: null }));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NO_CLUB');
  });

  test('unknown status filter -> 400', async () => {
    const res = await mine('?status=NOPE');
    expect(res.status).toBe(400);
    expect(proposalRepo.listByClub).not.toHaveBeenCalled();
  });

  test('repository failure -> 500 JSON without a stack trace', async () => {
    proposalRepo.listByClub.mockRejectedValue(new Error('connection lost'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await mine();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'SERVER_ERROR', message: 'Something went wrong' });
    spy.mockRestore();
  });
});
