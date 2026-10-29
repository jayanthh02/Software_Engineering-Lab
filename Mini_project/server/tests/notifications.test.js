const request = require('supertest');
const jwt = require('jsonwebtoken');

// No real database: the repository is replaced by a mock.
jest.mock('../src/repositories/notificationRepo');
const notificationRepo = require('../src/repositories/notificationRepo');
const notificationService = require('../src/services/notificationService');
const app = require('../src/app');

function tokenFor(id, role) {
  return jwt.sign({ sub: id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const proposal = { id: 42, eventName: 'AI Talk', clubLeadId: 1 };

beforeEach(() => {
  jest.resetAllMocks();
});

describe('TC-NOTI-01 notifications on status change (SCP-F-009)', () => {
  test('new submission notifies the Faculty Coordinator only', async () => {
    await notificationService.notifyStatusChange(proposal, null, 'PENDING_FACULTY');

    expect(notificationRepo.createForRole).toHaveBeenCalledWith(
      'FACULTY',
      'Proposal "AI Talk" is waiting for your review.',
      42
    );
    expect(notificationRepo.createForUser).not.toHaveBeenCalled();
  });

  test('Faculty approval notifies the Finance Officer and the Club Lead', async () => {
    await notificationService.notifyStatusChange(proposal, 'PENDING_FACULTY', 'PENDING_FINANCE');

    expect(notificationRepo.createForRole).toHaveBeenCalledWith(
      'FINANCE',
      expect.stringContaining('waiting for your review'),
      42
    );
    expect(notificationRepo.createForUser).toHaveBeenCalledWith(
      1,
      'Your proposal "AI Talk" was approved by the Faculty Coordinator and is now with the Finance Officer.',
      42
    );
  });

  test('Finance approval notifies the Dean and the Club Lead', async () => {
    await notificationService.notifyStatusChange(proposal, 'PENDING_FINANCE', 'PENDING_DEAN');

    expect(notificationRepo.createForRole).toHaveBeenCalledWith('DEAN', expect.any(String), 42);
    expect(notificationRepo.createForUser).toHaveBeenCalledWith(1, expect.stringContaining('Dean'), 42);
  });

  test('Dean approval notifies only the Club Lead (no next approver)', async () => {
    await notificationService.notifyStatusChange(proposal, 'PENDING_DEAN', 'APPROVED');

    expect(notificationRepo.createForRole).not.toHaveBeenCalled();
    expect(notificationRepo.createForUser).toHaveBeenCalledWith(
      1,
      'Your proposal "AI Talk" was approved by the Dean and is now fully approved.',
      42
    );
  });

  test('rejection notifies only the Club Lead, naming the stage that rejected it', async () => {
    await notificationService.notifyStatusChange(proposal, 'PENDING_FINANCE', 'REJECTED');

    expect(notificationRepo.createForRole).not.toHaveBeenCalled();
    expect(notificationRepo.createForUser).toHaveBeenCalledWith(
      1,
      'Your proposal "AI Talk" was rejected by the Finance Officer.',
      42
    );
  });

  test('resubmission after rejection notifies the Faculty Coordinator again', async () => {
    await notificationService.notifyStatusChange(proposal, 'REJECTED', 'PENDING_FACULTY');

    expect(notificationRepo.createForRole).toHaveBeenCalledWith('FACULTY', expect.any(String), 42);
    expect(notificationRepo.createForUser).not.toHaveBeenCalled();
  });

  test('very long event names are clipped to fit the 255-character column', async () => {
    const long = { ...proposal, eventName: 'x'.repeat(400) };
    await notificationService.notifyStatusChange(long, 'PENDING_FACULTY', 'REJECTED');

    const message = notificationRepo.createForUser.mock.calls[0][1];
    expect(message.length).toBeLessThanOrEqual(255);
  });
});

describe('Notifications API (SCP-F-009)', () => {
  test('GET /api/notifications returns only the caller\'s notifications and unread count', async () => {
    notificationRepo.listForUser.mockResolvedValue([
      { id: 5, proposal_id: 42, message: 'Proposal "AI Talk" is waiting for your review.', is_read: 0, created_at: '2026-10-29T10:00:00Z' },
    ]);
    notificationRepo.countUnread.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor(3, 'FACULTY')}`);

    expect(res.status).toBe(200);
    expect(notificationRepo.listForUser).toHaveBeenCalledWith(3);
    expect(res.body).toEqual({
      unreadCount: 1,
      items: [
        {
          id: 5,
          proposalId: 42,
          message: 'Proposal "AI Talk" is waiting for your review.',
          read: false,
          createdAt: '2026-10-29T10:00:00Z',
        },
      ],
    });
  });

  test('PATCH /:id/read marks the caller\'s own notification as read', async () => {
    notificationRepo.markRead.mockResolvedValue(true);

    const res = await request(app)
      .patch('/api/notifications/5/read')
      .set('Authorization', `Bearer ${tokenFor(3, 'FACULTY')}`);

    expect(res.status).toBe(200);
    expect(notificationRepo.markRead).toHaveBeenCalledWith(5, 3);
  });

  test('PATCH /:id/read on someone else\'s or a missing notification returns 404', async () => {
    notificationRepo.markRead.mockResolvedValue(false);

    const res = await request(app)
      .patch('/api/notifications/99/read')
      .set('Authorization', `Bearer ${tokenFor(3, 'FACULTY')}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  test('PATCH /:id/read with a non-numeric id returns 400', async () => {
    const res = await request(app)
      .patch('/api/notifications/abc/read')
      .set('Authorization', `Bearer ${tokenFor(3, 'FACULTY')}`);

    expect(res.status).toBe(400);
    expect(notificationRepo.markRead).not.toHaveBeenCalled();
  });

  test('POST /read-all marks all of the caller\'s notifications as read', async () => {
    const res = await request(app)
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${tokenFor(7, 'STUDENT')}`);

    expect(res.status).toBe(200);
    expect(notificationRepo.markAllRead).toHaveBeenCalledWith(7);
  });

  test('a database error returns 500 JSON without a stack trace', async () => {
    notificationRepo.listForUser.mockRejectedValue(new Error('db down'));
    notificationRepo.countUnread.mockResolvedValue(0);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor(3, 'FACULTY')}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'SERVER_ERROR', message: 'Something went wrong' });
    errSpy.mockRestore();
  });
});

describe('TC-SEC-02 token checks on notifications (SCP-SR-002)', () => {
  test.each([
    ['get', '/api/notifications'],
    ['patch', '/api/notifications/5/read'],
    ['post', '/api/notifications/read-all'],
  ])('%s %s without a token returns 401', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
    expect(notificationRepo.listForUser).not.toHaveBeenCalled();
    expect(notificationRepo.markRead).not.toHaveBeenCalled();
    expect(notificationRepo.markAllRead).not.toHaveBeenCalled();
  });
});
