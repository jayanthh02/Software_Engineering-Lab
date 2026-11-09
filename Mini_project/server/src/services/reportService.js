const reportRepo = require('../repositories/reportRepo');

// SCP-F-015: budget allocation and event attendance reports as CSV.
// (PDF export is a stretch goal and is not part of this story.)

const STATUS_LABEL = {
  PENDING_FACULTY: 'Pending Faculty',
  PENDING_FINANCE: 'Pending Finance',
  PENDING_DEAN: 'Pending Dean',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/**
 * One CSV cell. Quotes every value and doubles inner quotes (RFC 4180).
 * Text starting with = + - @ (or tab / CR) is prefixed with ' so a spreadsheet
 * does not run it as a formula (CSV / formula injection).
 */
function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(header, rows) {
  // BOM so Excel opens UTF-8 (club / event names) correctly; CRLF line ends per RFC 4180.
  return `﻿${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

// DATE columns may arrive as Date objects or 'YYYY-MM-DD' strings.
// mysql2 gives a DATE as a Date at LOCAL midnight, so use the local parts.
// toISOString() would convert to UTC and print the day before in IST.
function day(value) {
  if (!value) return '';
  if (value instanceof Date) {
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${mm}-${dd}`;
  }
  return String(value).slice(0, 10);
}

function money(value) {
  return Number(value).toFixed(2);
}

async function budgetCsv(filters) {
  const rows = await reportRepo.budgetRows(filters);
  let approved = 0;
  let pending = 0;
  let rejected = 0;

  const body = rows.map((p) => {
    const budget = Number(p.budget);
    if (p.status === 'APPROVED') approved += budget;
    else if (p.status === 'REJECTED') rejected += budget;
    else pending += budget;
    return [p.id, p.club_name, p.event_name, day(p.event_date), STATUS_LABEL[p.status] || p.status,
      money(budget), day(p.created_at)];
  });

  body.push([]);
  body.push(['', '', '', '', 'Total approved', money(approved), '']);
  body.push(['', '', '', '', 'Total pending', money(pending), '']);
  body.push(['', '', '', '', 'Total rejected', money(rejected), '']);

  return toCsv(['Proposal ID', 'Club', 'Event', 'Event Date', 'Status', 'Budget (INR)', 'Submitted On'], body);
}

async function attendanceCsv(filters) {
  const rows = await reportRepo.attendanceRows(filters);
  let expected = 0;
  let registered = 0;
  let tickets = 0;
  let seatsLeft = 0;

  const body = rows.map((e) => {
    const left = Math.max(0, Number(e.expected_attendance) - Number(e.registered));
    expected += Number(e.expected_attendance);
    registered += Number(e.registered);
    tickets += Number(e.tickets_issued);
    seatsLeft += left;
    return [e.id, e.club_name, e.event_name, day(e.event_date), e.venue, Number(e.expected_attendance),
      Number(e.registered), Number(e.tickets_issued), left];
  });

  body.push([]);
  body.push(['', '', '', '', 'Total', expected, registered, tickets, seatsLeft]);

  return toCsv(['Event ID', 'Club', 'Event', 'Event Date', 'Venue', 'Expected Attendance', 'Registered',
    'Tickets Issued', 'Seats Left'], body);
}

module.exports = { budgetCsv, attendanceCsv, csvCell, day };
