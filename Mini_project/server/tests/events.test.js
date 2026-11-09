const request = require('supertest');
const jwt = require('jsonwebtoken');

// No real database: the repository is replaced by a mock.
jest.mock('../src/repositories/eventRepo');
const eventRepo = require('../src/repositories/eventRepo');
const { day } = require('../src/services/eventService');
const app = require('../src/app');

function token(id, role, clubId = null) {
  return `Bearer ${jwt.sign({ sub: id, role, clubId }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}

const ROWS = [
  {
    id: 1, club_name: 'Coding Club', event_name: 'AI Talk', event_date: '2026-11-15',
    venue: 'Main Hall', description: 'Intro to AI', expected_attendance: 120, registered: 80, mine: 1,
  },
  {
    id: 4, club_name: 'Robotics Club', event_name: 'Drone Day', event_date: new Date(2026, 11, 1),
    venue: 'Ground', description: 'Flying demo', expected_attendance: 50, registered: 60, mine: 0,
  },
];

beforeEach(() => {
  jest.resetAllMocks();
  eventRepo.listUpcoming.mockResolvedValue(ROWS);
});

describe('TC-TKT-01 event list (SCP-F-010)', () => {
  test('a student sees approved upcoming events with seats left and their own status', async () => {
    const res = await request(app).get('/api/events').set('Authorization', token(3, 'STUDENT'));

    expect(res.status).toBe(200);
    expect(eventRepo.listUpcoming).toHaveBeenCalledWith(3);
    expect(res.body.items[0]).toEqual({
      id: 1,
      clubName: 'Coding Club',
      eventName: 'AI Talk',
      eventDate: '2026-11-15',
      venue: 'Main Hall',
      description: 'Intro to AI',
      capacity: 120,
      registered: 80,
      seatsLeft: 40,
      registeredByMe: true,
    });
  });

  test('seats left is never negative and a DATE object keeps its calendar day', async () => {
    const res = await request(app).get('/api/events').set('Authorization', token(3, 'STUDENT'));

    expect(res.body.items[1].seatsLeft).toBe(0);
    expect(res.body.items[1].registeredByMe).toBe(false);
    expect(res.body.items[1].eventDate).toBe('2026-12-01');
  });

  test('other roles can look, but no student id is used', async () => {
    const res = await request(app).get('/api/events').set('Authorization', token(1, 'CLUB_LEAD', 1));

    expect(res.status).toBe(200);
    expect(eventRepo.listUpcoming).toHaveBeenCalledWith(null);
  });

  test('no events gives an empty list', async () => {
    eventRepo.listUpcoming.mockResolvedValue([]);
    const res = await request(app).get('/api/events').set('Authorization', token(3, 'STUDENT'));

    expect(res.body).toEqual({ items: [] });
  });

  test('no token returns 401', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
    expect(eventRepo.listUpcoming).not.toHaveBeenCalled();
  });

  test('a database error returns 500 JSON without a stack trace', async () => {
    eventRepo.listUpcoming.mockRejectedValue(new Error('db down'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).get('/api/events').set('Authorization', token(3, 'STUDENT'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'SERVER_ERROR', message: 'Something went wrong' });
    errSpy.mockRestore();
  });

  test('day() formats local dates and strings as YYYY-MM-DD', () => {
    expect(day(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(day('2026-11-15T00:00:00')).toBe('2026-11-15');
    expect(day(null)).toBeNull();
  });
});
