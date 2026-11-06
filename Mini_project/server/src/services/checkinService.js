const checkinRepo = require('../repositories/checkinRepo');
const ticketService = require('./ticketService');

// SCP-20 (SCP-F-013): validate a ticket at check-in so each ticket is used once.
// Uses ticketService.verifyTicket (SCP-18) as it is; no ticket is created or signed here.

function fail(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

// Returns the stored ticket row, or null when the token is not a real ticket.
//  - Full QR text (ticketCode.registrationId.signature): its HMAC must be valid,
//    so a tampered code is rejected before the database is touched.
//  - Manual entry (only the ticket code): the code must exist in the database.
// In both cases the stored values must pass the HMAC check too.
async function findTicket(token) {
  const value = token.trim();
  let code;
  let scannedRegistrationId = null;

  if (value.includes('.')) {
    if (!ticketService.verifyTicket(value)) return null;
    [code, scannedRegistrationId] = value.split('.');
  } else {
    code = value.toLowerCase();
  }

  const ticket = await checkinRepo.findTicketByCode(code);
  if (!ticket) return null;

  if (scannedRegistrationId !== null && Number(scannedRegistrationId) !== Number(ticket.registration_id)) {
    return null;
  }

  const stored = `${ticket.ticket_code}.${ticket.registration_id}.${ticket.signature}`;
  if (!ticketService.verifyTicket(stored)) return null;

  return ticket;
}

/**
 * token: the scanned QR text, or a ticket code typed by hand (manual fallback).
 * user: req.user (a Club Lead, the organiser of their own club's events).
 *
 * Success -> { valid: true, studentName, eventName } and the ticket is now USED.
 * Errors (status / code / message):
 *   400 INVALID_TICKET 'Invalid'      (tampered, unknown or mistyped token)
 *   403 WRONG_EVENT 'Wrong event'     (a real ticket for an event this organiser does not run)
 *   409 ALREADY_USED 'Already used'
 */
async function validate(token, user) {
  const ticket = await findTicket(token);
  if (!ticket) {
    throw fail(400, 'INVALID_TICKET', 'Invalid');
  }

  if (!user.clubId || Number(ticket.club_id) !== Number(user.clubId)) {
    throw fail(403, 'WRONG_EVENT', 'Wrong event');
  }

  const used = await checkinRepo.markUsed(ticket.id, user.id);
  if (!used) {
    throw fail(409, 'ALREADY_USED', 'Already used');
  }

  return {
    valid: true,
    studentName: ticket.student_name,
    eventName: ticket.event_name,
  };
}

module.exports = { validate };
