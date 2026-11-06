const request = require('supertest');
const jwt = require('jsonwebtoken');

// No real database: the repository is replaced by a mock.
jest.mock('../src/repositories/checkinRepo');
const checkinRepo = require('../src/repositories/checkinRepo');
const ticketService = require('../src/services/ticketService');
const app = require('../src/app');

function tokenFor(id, role, clubId) {
  return jwt.sign({ sub: id, role, clubId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// The organiser: a Club Lead of club 10.
const organiser = () => `Bearer ${tokenFor(1, 'CLUB_LEAD', 10)}`;

// A real SCP-18 ticket, shaped like the row checkinRepo.findTicketByCode returns.
// The event belongs to club 10, the organiser's club.
function rowFor(ticket, overrides = {}) {
  return {
    id: 5,
    registration_id: 7,
    ticket_code: ticket.ticketCode,
    signature: ticket.signature,
    proposal_id: 42,
    club_id: 10,
    event_name: 'AI Talk',
    student_name: 'Asha',
    ...overrides,
  };
}

function post(body, auth = organiser()) {
  return request(app).post('/api/tickets/checkin').set('Authorization', auth).send(body);
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('TC-CHK-01 valid first check-in (SCP-F-013)', () => {
  test('scanning an unused ticket returns valid and the ticket becomes USED', async () => {
    const ticket = ticketService.createTicket(7);
    checkinRepo.findTicketByCode.mockResolvedValue(rowFor(ticket));
    checkinRepo.markUsed.mockResolvedValue(true);

    const res = await post({ token: ticket.qrPayload });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true, studentName: 'Asha', eventName: 'AI Talk' });
    expect(checkinRepo.findTicketByCode).toHaveBeenCalledWith(ticket.ticketCode);
    expect(checkinRepo.markUsed).toHaveBeenCalledWith(5, 1);
  });
});

describe('TC-CHK-02 duplicate, invalid and wrong-event tickets are rejected (SCP-F-013)', () => {
  test('scanning the same ticket again returns 409 "Already used"', async () => {
    const ticket = ticketService.createTicket(7);
    checkinRepo.findTicketByCode.mockResolvedValue(rowFor(ticket));
    checkinRepo.markUsed.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const first = await post({ token: ticket.qrPayload });
    const second = await post({ token: ticket.qrPayload });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: 'ALREADY_USED', message: 'Already used' });
  });

  test('a tampered token returns 400 "Invalid" and never touches the database', async () => {
    const ticket = ticketService.createTicket(7);
    const parts = ticket.qrPayload.split('.');
    parts[2] = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);

    const res = await post({ token: parts.join('.') });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'INVALID_TICKET', message: 'Invalid' });
    expect(checkinRepo.findTicketByCode).not.toHaveBeenCalled();
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });

  test('a token with a changed registration id returns "Invalid"', async () => {
    const ticket = ticketService.createTicket(7);
    const parts = ticket.qrPayload.split('.');
    parts[1] = '8';

    const res = await post({ token: parts.join('.') });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TICKET');
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });

  test('a correctly signed token that is not in the database returns "Invalid"', async () => {
    const ticket = ticketService.createTicket(7);
    checkinRepo.findTicketByCode.mockResolvedValue(null);

    const res = await post({ token: ticket.qrPayload });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TICKET');
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });

  test('a ticket for an event of another club returns 403 "Wrong event" and is not used up', async () => {
    const ticket = ticketService.createTicket(7);
    checkinRepo.findTicketByCode.mockResolvedValue(rowFor(ticket, { club_id: 77 }));

    const res = await post({ token: ticket.qrPayload });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'WRONG_EVENT', message: 'Wrong event' });
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });

  test('a Club Lead with no club cannot check anyone in', async () => {
    const ticket = ticketService.createTicket(7);
    checkinRepo.findTicketByCode.mockResolvedValue(rowFor(ticket));

    const res = await post({ token: ticket.qrPayload }, `Bearer ${tokenFor(2, 'CLUB_LEAD')}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WRONG_EVENT');
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });
});

describe('manual ticket-code entry fallback (SCP-F-013)', () => {
  test('a typed ticket code checks the person in (spaces and capitals are ignored)', async () => {
    const ticket = ticketService.createTicket(7);
    checkinRepo.findTicketByCode.mockResolvedValue(rowFor(ticket));
    checkinRepo.markUsed.mockResolvedValue(true);

    const res = await post({ token: `  ${ticket.ticketCode.toUpperCase()} ` });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true, studentName: 'Asha', eventName: 'AI Talk' });
    expect(checkinRepo.findTicketByCode).toHaveBeenCalledWith(ticket.ticketCode);
    expect(checkinRepo.markUsed).toHaveBeenCalledWith(5, 1);
  });

  test('a mistyped code returns "Invalid"', async () => {
    checkinRepo.findTicketByCode.mockResolvedValue(null);

    const res = await post({ token: '12345678-aaaa-bbbb-cccc-1234567890ab' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TICKET');
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });

  test('a typed code whose stored signature does not verify returns "Invalid"', async () => {
    const ticket = ticketService.createTicket(7);
    const bad = (ticket.signature[0] === 'a' ? 'b' : 'a') + ticket.signature.slice(1);
    checkinRepo.findTicketByCode.mockResolvedValue(rowFor(ticket, { signature: bad }));

    const res = await post({ token: ticket.ticketCode });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TICKET');
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });

  test('a typed code of another club\'s event returns 403 "Wrong event"', async () => {
    const ticket = ticketService.createTicket(7);
    checkinRepo.findTicketByCode.mockResolvedValue(rowFor(ticket, { club_id: 77 }));

    const res = await post({ token: ticket.ticketCode });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WRONG_EVENT');
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });

  test('a typed code that was already used returns 409 "Already used"', async () => {
    const ticket = ticketService.createTicket(7);
    checkinRepo.findTicketByCode.mockResolvedValue(rowFor(ticket));
    checkinRepo.markUsed.mockResolvedValue(false);

    const res = await post({ token: ticket.ticketCode });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'ALREADY_USED', message: 'Already used' });
  });
});

describe('check-in request rules', () => {
  test.each([
    ['no body', undefined],
    ['no token', {}],
    ['an empty token', { token: '   ' }],
    ['a non-string token', { token: 123 }],
    ['an oversized token', { token: 'a'.repeat(301) }],
  ])('%s returns 400', async (_name, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(checkinRepo.findTicketByCode).not.toHaveBeenCalled();
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });

  test('a database error returns 500 JSON without a stack trace', async () => {
    const ticket = ticketService.createTicket(7);
    checkinRepo.findTicketByCode.mockRejectedValue(new Error('db down'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await post({ token: ticket.qrPayload });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'SERVER_ERROR', message: 'Something went wrong' });
    errSpy.mockRestore();
  });
});

describe('TC-SEC-02 token and role checks on check-in (SCP-SR-002)', () => {
  test('without a token returns 401', async () => {
    const res = await request(app).post('/api/tickets/checkin').send({ token: 'x' });

    expect(res.status).toBe(401);
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });

  test.each(['STUDENT', 'FACULTY', 'FINANCE', 'DEAN', 'ADMIN'])('role %s returns 403', async (role) => {
    const res = await post({ token: 'x' }, `Bearer ${tokenFor(3, role, 10)}`);

    expect(res.status).toBe(403);
    expect(checkinRepo.markUsed).not.toHaveBeenCalled();
  });
});
