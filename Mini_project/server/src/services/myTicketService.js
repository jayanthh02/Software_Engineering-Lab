const QRCode = require('qrcode');
const ticketRepo = require('../repositories/ticketRepo');
const ticketService = require('./ticketService');

// SCP-19: My Tickets list and QR download.
// This file never creates tickets or signs anything. It reads the ticket that
// SCP-18 already stored and draws that same code as a QR image.

// MySQL DATE columns arrive as a Date at local midnight. Use the local parts
// (not toISOString) so the date never shifts by a day in IST.
function day(value) {
  if (value instanceof Date) {
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${mm}-${dd}`;
  }
  return value ? String(value).slice(0, 10) : null;
}

// USED once checked in (SCP-20), EXPIRED after the event day, otherwise UPCOMING.
function statusOf(eventDate, checkedInAt, today) {
  if (checkedInAt) return 'USED';
  if (eventDate && eventDate < today) return 'EXPIRED';
  return 'UPCOMING';
}

async function listMine(studentId, now = new Date()) {
  const rows = await ticketRepo.listForStudent(studentId);
  const today = day(now);
  return rows.map((t) => {
    const eventDate = day(t.event_date);
    const checkedInAt = t.checked_in_at || null;
    return {
      id: t.id,
      registrationId: t.registration_id,
      proposalId: t.proposal_id,
      clubName: t.club_name,
      eventName: t.event_name,
      eventDate,
      venue: t.venue,
      ticketCode: t.ticket_code,
      createdAt: t.created_at,
      checkedInAt,
      status: statusOf(eventDate, checkedInAt, today),
    };
  });
}

// Returns { png, filename }.
// Throws 404 when the ticket does not exist or belongs to someone else
// (same answer for both, so ticket ids cannot be probed).
async function getQrPng(ticketId, studentId) {
  const ticket = await ticketRepo.findById(ticketId);

  if (!ticket || Number(ticket.student_id) !== Number(studentId)) {
    const error = new Error('Ticket not found');
    error.status = 404;
    error.code = 'TICKET_NOT_FOUND';
    throw error;
  }

  // Same format ticketService.createTicket gives as qrPayload:
  // ticketCode.registrationId.signature (all three values come from the database).
  const qrPayload = `${ticket.ticket_code}.${ticket.registration_id}.${ticket.signature}`;

  // Never draw a QR for a ticket whose stored values fail the HMAC check.
  if (!ticketService.verifyTicket(qrPayload)) {
    const error = new Error('Ticket could not be verified');
    error.status = 500;
    error.code = 'TICKET_INVALID';
    throw error;
  }

  const png = await QRCode.toBuffer(qrPayload, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 400,
  });

  return { png, filename: `ticket-${ticket.id}.png` };
}

module.exports = { listMine, getQrPng };
