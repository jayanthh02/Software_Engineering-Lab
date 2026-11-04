const ticketService = require('../src/services/ticketService');

describe('HMAC Ticket Service', () => {
  test('creates a unique ticket with a valid signature', () => {
    const ticket = ticketService.createTicket(1);

    expect(ticket.ticketCode).toBeDefined();
    expect(ticket.signature).toHaveLength(64);
    expect(ticket.qrPayload).toContain(ticket.ticketCode);

    expect(ticketService.verifyTicket(ticket.qrPayload)).toBe(true);
  });

  test('generates different tickets for separate registrations', () => {
    const ticket1 = ticketService.createTicket(1);
    const ticket2 = ticketService.createTicket(2);

    expect(ticket1.ticketCode).not.toBe(ticket2.ticketCode);
  });

  test('rejects a modified ticket signature', () => {
    const ticket = ticketService.createTicket(1);
    const parts = ticket.qrPayload.split('.');

    parts[2] = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);

    expect(ticketService.verifyTicket(parts.join('.'))).toBe(false);
  });

  test('rejects an invalid ticket payload', () => {
    expect(ticketService.verifyTicket('invalid-ticket')).toBe(false);
  });
});