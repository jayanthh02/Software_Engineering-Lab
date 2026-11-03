const express = require('express');
const dashboardService = require('../services/dashboardService');
const { protect } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function badRequest(res, message) {
  return res.status(400).json({ error: 'VALIDATION_ERROR', message });
}

// GET /api/dashboard[?status=PENDING_FINANCE&clubId=2&from=2026-10-01&to=2026-10-31]
//   -> 200 { pipeline, totals, proposals, clubs }
//   400 bad filter, 401 not logged in, 403 not Admin / Club Lead, or a Club Lead asking for another club
router.get('/', protect(ROLES.ADMIN, ROLES.CLUB_LEAD), async (req, res, next) => {
  try {
    const { status, clubId, from, to } = req.query;
    const filters = { status: null, clubId: null, from: null, to: null };

    if (status !== undefined && status !== '') {
      if (!dashboardService.STATUSES.includes(status)) return badRequest(res, 'Unknown status filter');
      filters.status = status;
    }
    if (clubId !== undefined && clubId !== '') {
      const id = Number(clubId);
      if (!Number.isInteger(id) || id <= 0) return badRequest(res, 'Invalid club id');
      filters.clubId = id;
    }
    if (from !== undefined && from !== '') {
      if (!isValidDate(from)) return badRequest(res, 'From date must be YYYY-MM-DD');
      filters.from = from;
    }
    if (to !== undefined && to !== '') {
      if (!isValidDate(to)) return badRequest(res, 'To date must be YYYY-MM-DD');
      filters.to = to;
    }
    if (filters.from && filters.to && filters.from > filters.to) {
      return badRequest(res, 'From date must be on or before the To date');
    }

    return res.status(200).json(await dashboardService.getDashboard(req.user, filters));
  } catch (err) {
    if (err instanceof dashboardService.DashboardError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    return next(err);
  }
});

module.exports = router;
