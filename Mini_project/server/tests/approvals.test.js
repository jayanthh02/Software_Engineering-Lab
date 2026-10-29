const request = require('supertest');
const jwt = require('jsonwebtoken');

// No real database: both repositories are mocked. The real notification
// service runs, so we can check who gets notified.
jest.mock('../src/repositories/approvalRepo');
jest.mock('../src/repositories/notificationRepo');
const approvalRepo = require('../src/repositories/approvalRepo');
const notificationRepo = require('../src/repositories/notificationRepo');
const app = require('../src/app');

const USERS = {
  FACULTY: { id: 3, role: 'FACULTY' },
  FINANCE: { id: 4, role: 'FINANCE' },
  DEAN: { id: 5, role: 'DEAN' },
  CLUB_LEAD: { id: 1, role: 'CLUB_LEAD' },
  STUDENT: { id: 7, role: 'STUDENT' },
  ADMIN: { id: 6, role: 'ADMIN' },
};

function auth(role) {
  const u = USERS[role];
  return `Bearer ${jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}

function proposalAt(status) {
  return { id: 42, event_name: 'AI Talk', club_lead_id: 1, status };
}

function decide(role, body, id = 42) {
  return request(app).post(`/api/proposals/${id}/decision`).set('Authorization', auth(role)).send(body);
}

beforeEach(() => {
  jest.resetAllMocks();
  approvalRepo.recordDecision.mockResolvedValue(true);
});

describe('TC-APPR-01 stage order is enforced (SCP-F-006)', () => {
  test('Dean cannot approve a proposal still pending at Faculty; status unchanged', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_FACULTY'));

    const res = await decide('DEAN', { decision: 'APPROVE' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NOT_CURRENT_STAGE');
    expect(approvalRepo.recordDecision).not.toHaveBeenCalled();
  });

  test('Finance cannot act before Faculty approval', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_FACULTY'));
    const res = await decide('FINANCE', { decision: 'APPROVE' });
    expect(res.status).toBe(403);
  });

  test('a fully approved or rejected proposal cannot be decided again', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('APPROVED'));
    const approved = await decide('DEAN', { decision: 'REJECT', comment: 'late' });

    approvalRepo.findProposalById.mockResolvedValue(proposalAt('REJECTED'));
    const rejected = await decide('FACULTY', { decision: 'APPROVE' });

    expect(approved.status).toBe(403);
    expect(rejected.status).toBe(403);
    expect(approvalRepo.recordDecision).not.toHaveBeenCalled();
  });

  test.each([
    ['FACULTY', 'PENDING_FACULTY', 'PENDING_FINANCE'],
    ['FINANCE', 'PENDING_FINANCE', 'PENDING_DEAN'],
    ['DEAN', 'PENDING_DEAN', 'APPROVED'],
  ])('%s approval moves %s to %s', async (role, from, to) => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt(from));

    const res = await decide(role, { decision: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ proposalId: 42, newStatus: to });
    expect(approvalRepo.recordDecision).toHaveBeenCalledWith(
      expect.objectContaining({ proposalId: 42, fromStatus: from, toStatus: to })
    );
  });
});

describe('TC-APPR-02 approve / reject with comment (SCP-F-007)', () => {
  test('inbox shows only proposals at the caller\'s stage', async () => {
    approvalRepo.listByStatus.mockResolvedValue([
      {
        id: 42,
        event_name: 'AI Talk',
        club_name: 'Coding Club',
        event_date: '2026-11-15',
        venue: 'Main Hall',
        expected_attendance: 120,
        budget: '50000.00',
        description: 'Guest talk',
        status: 'PENDING_FACULTY',
        created_at: '2026-10-29T10:00:00Z',
      },
    ]);

    const res = await request(app).get('/api/approvals/inbox').set('Authorization', auth('FACULTY'));

    expect(res.status).toBe(200);
    expect(approvalRepo.listByStatus).toHaveBeenCalledWith('PENDING_FACULTY');
    expect(res.body[0]).toMatchObject({ id: 42, eventName: 'AI Talk', clubName: 'Coding Club', budget: 50000 });
  });

  test.each([
    ['FINANCE', 'PENDING_FINANCE'],
    ['DEAN', 'PENDING_DEAN'],
  ])('%s inbox reads %s', async (role, status) => {
    approvalRepo.listByStatus.mockResolvedValue([]);
    const res = await request(app).get('/api/approvals/inbox').set('Authorization', auth(role));
    expect(res.status).toBe(200);
    expect(approvalRepo.listByStatus).toHaveBeenCalledWith(status);
  });

  test('Faculty approves: proposal moves to PENDING_FINANCE', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_FACULTY'));
    const res = await decide('FACULTY', { decision: 'APPROVE' });
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe('PENDING_FINANCE');
  });

  test('reject without a comment is blocked with 400 COMMENT_REQUIRED', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_FINANCE'));

    const missing = await decide('FINANCE', { decision: 'REJECT' });
    const blank = await decide('FINANCE', { decision: 'REJECT', comment: '   ' });

    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('COMMENT_REQUIRED');
    expect(blank.status).toBe(400);
    expect(approvalRepo.recordDecision).not.toHaveBeenCalled();
  });

  test('reject with a comment moves the proposal to REJECTED', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_FINANCE'));

    const res = await decide('FINANCE', { decision: 'REJECT', comment: '  Budget too high  ' });

    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe('REJECTED');
    expect(approvalRepo.recordDecision).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: 'REJECTED', decision: 'REJECT', comment: 'Budget too high' })
    );
  });

  test('invalid decision, id, or comment type returns 400', async () => {
    const badDecision = await decide('FACULTY', { decision: 'MAYBE' });
    const badId = await decide('FACULTY', { decision: 'APPROVE' }, 'abc');
    const badComment = await decide('FACULTY', { decision: 'REJECT', comment: { x: 1 } });
    const tooLong = await decide('FACULTY', { decision: 'REJECT', comment: 'x'.repeat(501) });

    expect([badDecision.status, badId.status, badComment.status, tooLong.status]).toEqual([400, 400, 400, 400]);
    expect(approvalRepo.findProposalById).not.toHaveBeenCalled();
  });

  test('unknown proposal returns 404', async () => {
    approvalRepo.findProposalById.mockResolvedValue(null);
    const res = await decide('FACULTY', { decision: 'APPROVE' }, 999);
    expect(res.status).toBe(404);
  });

  test('two approvers deciding at the same time: the second gets 409', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_FACULTY'));
    approvalRepo.recordDecision.mockResolvedValue(false); // status changed in between

    const res = await decide('FACULTY', { decision: 'APPROVE' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_DECIDED');
    expect(notificationRepo.createForRole).not.toHaveBeenCalled();
  });
});

describe('TC-APPR-03 approval history recorded (SCP-F-008)', () => {
  test('every decision writes stage, approver, decision and comment', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_DEAN'));

    await decide('DEAN', { decision: 'APPROVE', comment: 'Looks good' });

    expect(approvalRepo.recordDecision).toHaveBeenCalledWith({
      proposalId: 42,
      fromStatus: 'PENDING_DEAN',
      toStatus: 'APPROVED',
      stage: 'DEAN',
      approverId: 5,
      decision: 'APPROVE',
      comment: 'Looks good',
    });
  });

  test('an approval without a comment stores null', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_FACULTY'));
    await decide('FACULTY', { decision: 'APPROVE' });
    expect(approvalRepo.recordDecision).toHaveBeenCalledWith(expect.objectContaining({ comment: null }));
  });
});

describe('TC-NOTI-01 decisions send notifications (SCP-F-009)', () => {
  test('Faculty approval notifies Finance and the Club Lead', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_FACULTY'));

    await decide('FACULTY', { decision: 'APPROVE' });

    expect(notificationRepo.createForRole).toHaveBeenCalledWith('FINANCE', expect.any(String), 42);
    expect(notificationRepo.createForUser).toHaveBeenCalledWith(1, expect.stringContaining('approved'), 42);
  });

  test('rejection notifies the Club Lead only', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_DEAN'));

    await decide('DEAN', { decision: 'REJECT', comment: 'Date clash' });

    expect(notificationRepo.createForRole).not.toHaveBeenCalled();
    expect(notificationRepo.createForUser).toHaveBeenCalledWith(1, expect.stringContaining('rejected by the Dean'), 42);
  });

  test('a notification failure does not undo or fail the saved decision', async () => {
    approvalRepo.findProposalById.mockResolvedValue(proposalAt('PENDING_FACULTY'));
    notificationRepo.createForRole.mockRejectedValue(new Error('db hiccup'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await decide('FACULTY', { decision: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe('PENDING_FINANCE');
    errSpy.mockRestore();
  });
});

describe('TC-AUTH-02 / TC-SEC-02 role and token checks (SCP-F-002, SCP-SR-002)', () => {
  test.each(['STUDENT', 'CLUB_LEAD', 'ADMIN'])('%s gets 403 on decision and inbox', async (role) => {
    const d = await decide(role, { decision: 'APPROVE' });
    const inbox = await request(app).get('/api/approvals/inbox').set('Authorization', auth(role));

    expect(d.status).toBe(403);
    expect(inbox.status).toBe(403);
    expect(approvalRepo.findProposalById).not.toHaveBeenCalled();
    expect(approvalRepo.listByStatus).not.toHaveBeenCalled();
  });

  test('no token returns 401', async () => {
    const d = await request(app).post('/api/proposals/42/decision').send({ decision: 'APPROVE' });
    const inbox = await request(app).get('/api/approvals/inbox');
    expect(d.status).toBe(401);
    expect(inbox.status).toBe(401);
  });

  test('unknown /api routes still return 404, not 401', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
