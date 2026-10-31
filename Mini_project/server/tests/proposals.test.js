const request = require('supertest');
const jwt = require('jsonwebtoken');

// No real database: both repositories are mocked. The real notification
// service runs, so we can check the Faculty Coordinator is told.
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
    eventName: 'AI Workshop',
    eventDate: futureDate(),
    venue: 'Main Auditorium',
    expectedAttendance: 120,
    budget: 25000,
    description: 'Hands-on workshop on machine learning basics.',
    ...overrides,
  };
}

function submit(body, auth = token('CLUB_LEAD')) {
  const req = request(app).post('/api/proposals');
  return (auth ? req.set('Authorization', auth) : req).send(body);
}

beforeEach(() => {
  jest.resetAllMocks();
  proposalRepo.create.mockResolvedValue(77);
  notificationRepo.createForRole.mockResolvedValue();
});

describe('TC-PROP-01 submit proposal with all / missing fields (SCP-F-003)', () => {
  test('valid form -> 201 with status PENDING_FACULTY, saved for the lead\'s club', async () => {
    const res = await submit(validBody());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ proposalId: 77, status: 'PENDING_FACULTY' });
    expect(proposalRepo.create).toHaveBeenCalledTimes(1);
    expect(proposalRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: 2,
        clubLeadId: 1,
        eventName: 'AI Workshop',
        expectedAttendance: 120,
        budget: 25000,
      })
    );
  });

  test('budget empty -> 400 with a field error and nothing saved', async () => {
    const res = await submit(validBody({ budget: '' }));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.fields.budget).toBeDefined();
    expect(proposalRepo.create).not.toHaveBeenCalled();
  });

  test.each(['eventName', 'eventDate', 'venue', 'expectedAttendance', 'budget', 'description'])(
    'missing %s -> 400 with an error on that field',
    async (field) => {
      const body = validBody();
      delete body[field];

      const res = await submit(body);

      expect(res.status).toBe(400);
      expect(Object.keys(res.body.fields)).toEqual([field]);
      expect(proposalRepo.create).not.toHaveBeenCalled();
    }
  );

  test('all fields missing -> 400 listing every field', async () => {
    const res = await submit({});
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(
      ['budget', 'description', 'eventDate', 'eventName', 'expectedAttendance', 'venue']
    );
  });

  test.each([0, -500, 'abc', '12.345', '1e3', null])('budget %p is not a positive number -> 400', async (budget) => {
    const res = await submit(validBody({ budget }));
    expect(res.status).toBe(400);
    expect(res.body.fields.budget).toBeDefined();
    expect(proposalRepo.create).not.toHaveBeenCalled();
  });

  test('budget and attendance sent as numeric strings (HTML form) are accepted', async () => {
    const res = await submit(validBody({ budget: '15000.50', expectedAttendance: '80' }));
    expect(res.status).toBe(201);
    expect(proposalRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ budget: 15000.5, expectedAttendance: 80 })
    );
  });

  test.each([0, -3, 2.5, 'many'])('expected attendance %p is invalid -> 400', async (value) => {
    const res = await submit(validBody({ expectedAttendance: value }));
    expect(res.status).toBe(400);
    expect(res.body.fields.expectedAttendance).toBeDefined();
  });

  test('past date and impossible date -> 400', async () => {
    const past = await submit(validBody({ eventDate: '2020-01-01' }));
    const fake = await submit(validBody({ eventDate: '2030-02-31' }));

    expect(past.status).toBe(400);
    expect(past.body.fields.eventDate).toBeDefined();
    expect(fake.status).toBe(400);
    expect(fake.body.fields.eventDate).toBeDefined();
  });

  test('blank (spaces only) and over-long text fields -> 400', async () => {
    const res = await submit(validBody({ eventName: '   ', venue: 'x'.repeat(151) }));
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['eventName', 'venue']);
  });

  test('text is trimmed before saving', async () => {
    await submit(validBody({ eventName: '  Hack Night  ' }));
    expect(proposalRepo.create).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'Hack Night' }));
  });

  test('client cannot choose the club, lead or status', async () => {
    await submit(validBody({ clubId: 99, clubLeadId: 99, status: 'APPROVED' }));
    const saved = proposalRepo.create.mock.calls[0][0];
    expect(saved.clubId).toBe(2);
    expect(saved.clubLeadId).toBe(1);
    expect(saved).not.toHaveProperty('status');
  });

  test('Faculty Coordinators are notified; the Club Lead is not', async () => {
    await submit(validBody());
    expect(notificationRepo.createForRole).toHaveBeenCalledWith('FACULTY', expect.stringContaining('AI Workshop'), 77);
    expect(notificationRepo.createForUser).not.toHaveBeenCalled();
  });

  test('a notification failure does not turn a saved proposal into an error', async () => {
    notificationRepo.createForRole.mockRejectedValue(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await submit(validBody());

    expect(res.status).toBe(201);
    spy.mockRestore();
  });
});

describe('access rules for POST /api/proposals (SCP-F-002)', () => {
  test('no token -> 401', async () => {
    const res = await submit(validBody(), null);
    expect(res.status).toBe(401);
    expect(proposalRepo.create).not.toHaveBeenCalled();
  });

  test.each(['STUDENT', 'FACULTY', 'FINANCE', 'DEAN', 'ADMIN'])('%s -> 403', async (role) => {
    const res = await submit(validBody(), token(role));
    expect(res.status).toBe(403);
    expect(proposalRepo.create).not.toHaveBeenCalled();
  });

  test('Club Lead whose account has no club -> 403 NO_CLUB', async () => {
    const res = await submit(validBody(), token('CLUB_LEAD', { clubId: null }));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('NO_CLUB');
    expect(proposalRepo.create).not.toHaveBeenCalled();
  });
});

describe('errors are JSON without stack traces', () => {
  test('repository failure -> 500 SERVER_ERROR', async () => {
    proposalRepo.create.mockRejectedValue(new Error('connection lost'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await submit(validBody());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'SERVER_ERROR', message: 'Something went wrong' });
    spy.mockRestore();
  });
});
