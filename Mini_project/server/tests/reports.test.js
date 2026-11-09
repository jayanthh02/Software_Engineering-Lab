const request = require('supertest');
const jwt = require('jsonwebtoken');

// No real database: both repositories are mocked. The dashboard is called with
// the same data to prove the CSV totals match the dashboard totals.
jest.mock('../src/repositories/reportRepo');
jest.mock('../src/repositories/dashboardRepo');
const reportRepo = require('../src/repositories/reportRepo');
const dashboardRepo = require('../src/repositories/dashboardRepo');
const { csvCell, day } = require('../src/services/reportService');
const app = require('../src/app');

function token(role, clubId = null) {
  return `Bearer ${jwt.sign({ sub: 9, role, clubId }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
}
const ADMIN = token('ADMIN');

function get(path, auth = ADMIN) {
  const req = request(app).get(`/api/reports/${path}`);
  return auth ? req.set('Authorization', auth) : req;
}

// Splits the CSV body into rows of cell values (all cells are quoted).
function parse(text) {
  return text
    .replace(/^﻿/, '')
    .trim()
    .split('\r\n')
    .map((line) => (line === '' ? [] : line.slice(1, -1).split('","').map((c) => c.replace(/""/g, '"'))));
}

const PROPOSALS = [
  { id: 1, club_name: 'Coding Club', event_name: 'AI Talk', event_date: '2026-11-15', status: 'APPROVED', budget: '50000.00', created_at: '2026-10-28T10:00:00Z' },
  { id: 2, club_name: 'Coding Club', event_name: 'Hackathon', event_date: '2026-11-25', status: 'PENDING_FINANCE', budget: '80000.00', created_at: '2026-10-30T10:00:00Z' },
  { id: 3, club_name: 'Robotics Club', event_name: 'Robo Race', event_date: '2026-11-20', status: 'REJECTED', budget: '20000.00', created_at: '2026-10-29T10:00:00Z' },
  { id: 4, club_name: 'Robotics Club', event_name: 'Drone Day', event_date: new Date('2026-12-01T00:00:00Z'), status: 'APPROVED', budget: '15000.50', created_at: new Date('2026-10-31T10:00:00Z') },
];

const EVENTS = [
  { id: 1, club_name: 'Coding Club', event_name: 'AI Talk', event_date: '2026-11-15', venue: 'Main Hall', expected_attendance: 120, registered: 80, tickets_issued: 80 },
  { id: 4, club_name: 'Robotics Club', event_name: 'Drone Day', event_date: '2026-12-01', venue: 'Ground', expected_attendance: 50, registered: 60, tickets_issued: 60 },
];

beforeEach(() => {
  jest.resetAllMocks();
  reportRepo.budgetRows.mockResolvedValue(PROPOSALS);
  reportRepo.attendanceRows.mockResolvedValue(EVENTS);
});

describe('TC-DASH-02 export budget / attendance report (SCP-F-015)', () => {
  test('budget report downloads as a CSV file with a dated file name', async () => {
    const res = await get('budget.csv');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="budget-report-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(res.text.startsWith('﻿')).toBe(true);
  });

  test('budget report lists every proposal with readable status, date and budget', async () => {
    const rows = parse((await get('budget.csv')).text);

    expect(rows[0]).toEqual(['Proposal ID', 'Club', 'Event', 'Event Date', 'Status', 'Budget (INR)', 'Submitted On']);
    expect(rows[1]).toEqual(['1', 'Coding Club', 'AI Talk', '2026-11-15', 'Approved', '50000.00', '2026-10-28']);
    expect(rows[2]).toEqual(['2', 'Coding Club', 'Hackathon', '2026-11-25', 'Pending Finance', '80000.00', '2026-10-30']);
    // DATE values that arrive as Date objects are written as YYYY-MM-DD too.
    expect(rows[4]).toEqual(['4', 'Robotics Club', 'Drone Day', '2026-12-01', 'Approved', '15000.50', '2026-10-31']);
  });

  test('budget totals match the dashboard totals for the same data', async () => {
    dashboardRepo.pipeline.mockResolvedValue([
      { status: 'APPROVED', count: 2, budget: '65000.50' },
      { status: 'PENDING_FINANCE', count: 1, budget: '80000.00' },
      { status: 'REJECTED', count: 1, budget: '20000.00' },
    ]);
    dashboardRepo.listProposals.mockResolvedValue([]);
    dashboardRepo.listClubs.mockResolvedValue([]);

    const dash = await request(app).get('/api/dashboard').set('Authorization', ADMIN);
    const rows = parse((await get('budget.csv')).text);
    const total = (label) => rows.find((r) => r[4] === label)[5];

    expect(total('Total approved')).toBe(dash.body.totals.approvedBudget.toFixed(2));
    expect(total('Total pending')).toBe(dash.body.totals.pendingBudget.toFixed(2));
    expect(total('Total rejected')).toBe('20000.00');
  });

  test('attendance report lists approved events with registered, tickets and seats left', async () => {
    const res = await get('attendance.csv');
    const rows = parse(res.text);

    expect(res.headers['content-disposition']).toMatch(/filename="attendance-report-/);
    expect(rows[0]).toEqual(['Event ID', 'Club', 'Event', 'Event Date', 'Venue', 'Expected Attendance', 'Registered', 'Tickets Issued', 'Seats Left']);
    expect(rows[1]).toEqual(['1', 'Coding Club', 'AI Talk', '2026-11-15', 'Main Hall', '120', '80', '80', '40']);
    // More registered than expected never shows negative seats.
    expect(rows[2][8]).toBe('0');
    expect(rows[rows.length - 1]).toEqual(['', '', '', '', 'Total', '170', '140', '140', '40']);
  });

  test('filters are validated and passed to the repository', async () => {
    await get('budget.csv?clubId=2&from=2026-10-01&to=2026-10-31');
    await get('attendance.csv?clubId=1');

    expect(reportRepo.budgetRows).toHaveBeenCalledWith({ clubId: 2, from: '2026-10-01', to: '2026-10-31' });
    expect(reportRepo.attendanceRows).toHaveBeenCalledWith({ clubId: 1, from: null, to: null });
  });

  test('empty filter values mean no filter', async () => {
    await get('budget.csv?clubId=&from=&to=');
    expect(reportRepo.budgetRows).toHaveBeenCalledWith({ clubId: null, from: null, to: null });
  });

  test('an empty result still gives a valid CSV with headers and zero totals', async () => {
    reportRepo.budgetRows.mockResolvedValue([]);
    const rows = parse((await get('budget.csv')).text);

    expect(rows[0][0]).toBe('Proposal ID');
    expect(rows.find((r) => r[4] === 'Total approved')[5]).toBe('0.00');
  });

  test.each([
    ['budget.csv?clubId=abc', 'Invalid club id'],
    ['budget.csv?from=2026/10/01', 'From date must be YYYY-MM-DD'],
    ['attendance.csv?to=2026-02-30', 'To date must be YYYY-MM-DD'],
    ['budget.csv?from=2026-11-05&to=2026-11-01', 'From date must be on or before the To date'],
  ])('invalid filter %s returns 400 JSON', async (path, message) => {
    const res = await get(path);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'VALIDATION_ERROR', message });
    expect(reportRepo.budgetRows).not.toHaveBeenCalled();
    expect(reportRepo.attendanceRows).not.toHaveBeenCalled();
  });

  test('a database error returns 500 JSON without a stack trace', async () => {
    reportRepo.budgetRows.mockRejectedValue(new Error('db down'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await get('budget.csv');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'SERVER_ERROR', message: 'Something went wrong' });
    errSpy.mockRestore();
  });
});

describe('CSV safety (SCP-SR-004)', () => {
  test('quotes and commas in names are escaped, so columns never shift', async () => {
    reportRepo.budgetRows.mockResolvedValue([
      { ...PROPOSALS[0], club_name: 'Arts, Music & "Drama"', event_name: 'Open Mic' },
    ]);
    const res = await get('budget.csv');

    expect(res.text).toContain('"Arts, Music & ""Drama"""');
    expect(parse(res.text)[1][1]).toBe('Arts, Music & "Drama"');
  });

  test('text that a spreadsheet would run as a formula is neutralised', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(csvCell('+1+1')).toBe('"\'+1+1"');
    expect(csvCell('-2')).toBe('"\'-2"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
  });

  test('numbers are not altered by the formula guard', () => {
    expect(csvCell(-5)).toBe('"-5"');
    expect(csvCell(null)).toBe('""');
  });
});

describe('Report dates in IST (SCP-22 fix)', () => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Asia/Kolkata'; // the server runs in India
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  test('a MySQL DATE (local midnight) keeps its calendar day', () => {
    // mysql2 returns DATE 2026-11-16 as 16 Nov 00:00 IST = 15 Nov 18:30 UTC.
    expect(day(new Date(2026, 10, 16))).toBe('2026-11-16');
    expect(day('2026-11-16')).toBe('2026-11-16');
    expect(day(null)).toBe('');
  });

  test('budget and attendance CSVs show the real event day', async () => {
    reportRepo.budgetRows.mockResolvedValue([
      { ...PROPOSALS[0], event_date: new Date(2026, 10, 16), created_at: new Date(2026, 10, 9, 0, 15) },
    ]);
    reportRepo.attendanceRows.mockResolvedValue([{ ...EVENTS[0], event_date: new Date(2026, 10, 16) }]);

    const budget = parse((await get('budget.csv')).text);
    const attendance = parse((await get('attendance.csv')).text);

    expect(budget[1][3]).toBe('2026-11-16');
    expect(budget[1][6]).toBe('2026-11-09'); // submitted just after midnight IST
    expect(attendance[1][3]).toBe('2026-11-16');
  });
});

describe('TC-AUTH-02 / TC-SEC-02 role and token checks (SCP-F-002, SCP-SR-002)', () => {
  test.each(['CLUB_LEAD', 'STUDENT', 'FACULTY', 'FINANCE', 'DEAN'])('%s gets 403 on both reports', async (role) => {
    const budget = await get('budget.csv', token(role, 1));
    const attendance = await get('attendance.csv', token(role, 1));

    expect(budget.status).toBe(403);
    expect(attendance.status).toBe(403);
    expect(reportRepo.budgetRows).not.toHaveBeenCalled();
  });

  test('no token returns 401', async () => {
    const res = await get('budget.csv', null);
    expect(res.status).toBe(401);
  });
});
