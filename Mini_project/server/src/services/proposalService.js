const proposalRepo = require('../repositories/proposalRepo');
const notificationService = require('./notificationService');

// SCP-F-003: a Club Lead submits an event proposal. It is saved as PENDING_FACULTY.

const LIMITS = {
  eventName: 150, // proposals.event_name
  venue: 150, // proposals.venue
  description: 5000,
  maxAttendance: 100000,
  maxBudget: 99999999.99, // DECIMAL(10,2)
};

class ProposalError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Strict YYYY-MM-DD that is a real calendar date.
function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validates the request body. Returns { fields, values }.
 * `fields` maps a field name to an error message (empty object = valid).
 */
function validate(body) {
  const b = body || {};
  const fields = {};

  const eventName = text(b.eventName);
  if (!eventName) fields.eventName = 'Event name is required';
  else if (eventName.length > LIMITS.eventName) fields.eventName = `Event name must be at most ${LIMITS.eventName} characters`;

  const eventDate = text(b.eventDate);
  if (!eventDate) fields.eventDate = 'Event date is required';
  else if (!isRealDate(eventDate)) fields.eventDate = 'Event date must be a valid date (YYYY-MM-DD)';
  else if (eventDate < todayISO()) fields.eventDate = 'Event date cannot be in the past';

  const venue = text(b.venue);
  if (!venue) fields.venue = 'Venue is required';
  else if (venue.length > LIMITS.venue) fields.venue = `Venue must be at most ${LIMITS.venue} characters`;

  // Numbers may arrive as numbers or numeric strings from the form.
  const attendance = typeof b.expectedAttendance === 'string' ? b.expectedAttendance.trim() : b.expectedAttendance;
  if (attendance === undefined || attendance === null || attendance === '') {
    fields.expectedAttendance = 'Expected attendance is required';
  } else if (!/^\d+$/.test(String(attendance)) || Number(attendance) < 1 || Number(attendance) > LIMITS.maxAttendance) {
    fields.expectedAttendance = `Expected attendance must be a whole number between 1 and ${LIMITS.maxAttendance}`;
  }

  // Budget must be a positive number (SRS SCP-F-003 constraint), max 2 decimals.
  const budget = typeof b.budget === 'string' ? b.budget.trim() : b.budget;
  if (budget === undefined || budget === null || budget === '') {
    fields.budget = 'Budget is required';
  } else if (
    !/^\d+(\.\d{1,2})?$/.test(String(budget)) ||
    !(Number(budget) > 0) ||
    Number(budget) > LIMITS.maxBudget
  ) {
    fields.budget = 'Budget must be a positive amount (up to 2 decimal places)';
  }

  const description = text(b.description);
  if (!description) fields.description = 'Description is required';
  else if (description.length > LIMITS.description) fields.description = `Description must be at most ${LIMITS.description} characters`;

  return {
    fields,
    values: {
      eventName,
      eventDate,
      venue,
      expectedAttendance: Number(attendance),
      budget: Number(budget),
      description,
    },
  };
}

/**
 * Validates and saves a proposal for the logged-in Club Lead's club.
 * Throws ProposalError (400 field errors, 403 no club). Returns { proposalId, status }.
 */
async function submit(body, user) {
  const { fields, values } = validate(body);
  if (Object.keys(fields).length > 0) {
    throw new ProposalError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', fields);
  }
  if (!user.clubId) {
    throw new ProposalError(403, 'NO_CLUB', 'Your account is not linked to a club');
  }

  const proposalId = await proposalRepo.create({
    ...values,
    clubId: user.clubId,
    clubLeadId: user.id,
  });

  // The proposal is already saved; a notification problem must not turn it into an error.
  try {
    await notificationService.notifyStatusChange(
      { id: proposalId, eventName: values.eventName, clubLeadId: user.id },
      null,
      'PENDING_FACULTY'
    );
  } catch (err) {
    console.error('Notification failed:', err.message);
  }

  return { proposalId, status: 'PENDING_FACULTY' };
}

module.exports = { submit, validate, ProposalError };
