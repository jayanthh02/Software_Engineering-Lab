const request = require('supertest');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

// No real database: the repository is replaced by a mock.
jest.mock('../src/repositories/ticketRepo');
const ticketRepo = require('../src/repositories/ticketRepo');
const ticketService = require('../src/services/ticketService');
const app = require('../src/app');

function tokenFor(id, role) {
  return jwt.sign({ sub: id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// A real ticket from SCP-18, shaped like the row ticketRepo returns.
function rowFor(ticket, overrides = {}) {
  return {
    id: 5,
    registration_id: 7,
    ticket_code: ticket.ticketCode,
    signature: ticket.signature,
    created_at: '2026-11-01T10:00:00Z',
    proposal_id: 42,
    student_id: 3,
    event_name: 'AI Talk',
    event_date: '2026-12-01',
    venue: 'Main Hall',
    ...overrides,
  };
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeEach(() => {
  jest.resetAllMocks();
});

describe('My Tickets list (SCP-19)', () => {
  test('GET /api/tickets returns only the caller\'s tickets', async () => {
    const ticket = ticketService.createTicket(7);
    ticketRepo.listForStudent.mockResolvedValue([rowFor(ticket)]);

    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${tokenFor(3, 'STUDENT')}`);

    expect(res.status).toBe(200);
    expect(ticketRepo.listForStudent).toHaveBeenCalledWith(3);
    expect(res.body).toEqual({
      items: [
        {
          id: 5,
          registrationId: 7,
          proposalId: 42,
          eventName: 'AI Talk',
          eventDate: '2026-12-01',
          venue: 'Main Hall',
          ticketCode: ticket.ticketCode,
          createdAt: '2026-11-01T10:00:00Z',
        },
      ],
    });
    // The signature must never be sent in the list.
    expect(JSON.stringify(res.body)).not.toContain(ticket.signature);
  });

  test('a student with no tickets gets an empty list', async () => {
    ticketRepo.listForStudent.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${tokenFor(3, 'STUDENT')}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });
});

describe('QR download (SCP-19)', () => {
  test('GET /api/tickets/:id/qr returns the caller\'s existing ticket code as a PNG download', async () => {
    const ticket = ticketService.createTicket(7);
    ticketRepo.findById.mockResolvedValue(rowFor(ticket));

    const toBufferSpy = jest.spyOn(QRCode, 'toBuffer'); // calls through to the real library
    const createSpy = jest.spyOn(ticketService, 'createTicket');

    const res = await request(app)
      .get('/api/tickets/5/qr')
      .set('Authorization', `Bearer ${tokenFor(3, 'STUDENT')}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^image\/png/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="ticket-5.png"');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);

    // The QR holds the EXISTING ticket payload; no new code is created.
    expect(toBufferSpy.mock.calls[0][0]).toBe(ticket.qrPayload);
    expect(createSpy).not.toHaveBeenCalled();

    toBufferSpy.mockRestore();
    createSpy.mockRestore();
  });

  test('someone else\'s ticket returns 404 and draws no QR', async () => {
    const ticket = ticketService.createTicket(7);
    ticketRepo.findById.mockResolvedValue(rowFor(ticket, { student_id: 99 }));
    const toBufferSpy = jest.spyOn(QRCode, 'toBuffer');

    const res = await request(app)
      .get('/api/tickets/5/qr')
      .set('Authorization', `Bearer ${tokenFor(3, 'STUDENT')}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('TICKET_NOT_FOUND');
    expect(toBufferSpy).not.toHaveBeenCalled();

    toBufferSpy.mockRestore();
  });

  test('a missing ticket returns the same 404', async () => {
    ticketRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/tickets/999/qr')
      .set('Authorization', `Bearer ${tokenFor(3, 'STUDENT')}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('TICKET_NOT_FOUND');
  });

  test('a non-numeric ticket id returns 400', async () => {
    const res = await request(app)
      .get('/api/tickets/abc/qr')
      .set('Authorization', `Bearer ${tokenFor(3, 'STUDENT')}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(ticketRepo.findById).not.toHaveBeenCalled();
  });

  test('a stored ticket that fails the HMAC check returns 500 and draws no QR', async () => {
    const ticket = ticketService.createTicket(7);
    const badSignature = (ticket.signature[0] === 'a' ? 'b' : 'a') + ticket.signature.slice(1);
    ticketRepo.findById.mockResolvedValue(rowFor(ticket, { signature: badSignature }));
    const toBufferSpy = jest.spyOn(QRCode, 'toBuffer');

    const res = await request(app)
      .get('/api/tickets/5/qr')
      .set('Authorization', `Bearer ${tokenFor(3, 'STUDENT')}`);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('TICKET_INVALID');
    expect(toBufferSpy).not.toHaveBeenCalled();

    toBufferSpy.mockRestore();
  });
});

describe('Token and role checks on tickets (SCP-SR-002)', () => {
  test.each([
    ['/api/tickets'],
    ['/api/tickets/5/qr'],
  ])('GET %s without a token returns 401', async (url) => {
    const res = await request(app).get(url);

    expect(res.status).toBe(401);
    expect(ticketRepo.listForStudent).not.toHaveBeenCalled();
    expect(ticketRepo.findById).not.toHaveBeenCalled();
  });

  test.each([
    ['/api/tickets'],
    ['/api/tickets/5/qr'],
  ])('GET %s as a non-student returns 403', async (url) => {
    const res = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${tokenFor(1, 'CLUB_LEAD')}`);

    expect(res.status).toBe(403);
    expect(ticketRepo.listForStudent).not.toHaveBeenCalled();
    expect(ticketRepo.findById).not.toHaveBeenCalled();
  });
});
