const express = require('express');
const reportService = require('../services/reportService');
const { protect } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Reads ?clubId=&from=&to=. Returns { filters } or { error } for a 400.
function readFilters(query) {
  const filters = { clubId: null, from: null, to: null };
  const { clubId, from, to } = query;

  if (clubId !== undefined && clubId !== '') {
    const id = Number(clubId);
    if (!Number.isInteger(id) || id <= 0) return { error: 'Invalid club id' };
    filters.clubId = id;
  }
  if (from !== undefined && from !== '') {
    if (!isValidDate(from)) return { error: 'From date must be YYYY-MM-DD' };
    filters.from = from;
  }
  if (to !== undefined && to !== '') {
    if (!isValidDate(to)) return { error: 'To date must be YYYY-MM-DD' };
    filters.to = to;
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return { error: 'From date must be on or before the To date' };
  }
  return { filters };
}

function sendCsv(res, name, csv) {
  const today = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${name}-${today}.csv"`);
  return res.status(200).send(csv);
}

function exportRoute(name, build) {
  return async (req, res, next) => {
    try {
      const { filters, error } = readFilters(req.query);
      if (error) return res.status(400).json({ error: 'VALIDATION_ERROR', message: error });
      return sendCsv(res, name, await build(filters));
    } catch (err) {
      return next(err);
    }
  };
}

// GET /api/reports/budget.csv[?clubId=&from=&to=]      (from / to = submitted date)
// GET /api/reports/attendance.csv[?clubId=&from=&to=]  (from / to = event date, approved events only)
//   -> 200 text/csv download; 400 bad filter, 401 not logged in, 403 not Campus Admin
router.get('/budget.csv', protect(ROLES.ADMIN), exportRoute('budget-report', reportService.budgetCsv));
router.get('/attendance.csv', protect(ROLES.ADMIN), exportRoute('attendance-report', reportService.attendanceCsv));

module.exports = router;
