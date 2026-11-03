const dashboardRepo = require('../repositories/dashboardRepo');
const { ROLES } = require('../constants/roles');

// SCP-F-014: proposal pipeline (count per stage), proposal table and filters.
// Campus Admin sees every club; a Club Lead only ever sees their own club.

const STATUSES = ['PENDING_FACULTY', 'PENDING_FINANCE', 'PENDING_DEAN', 'APPROVED', 'REJECTED'];

class DashboardError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Work out the club filter for this user.
 * Club Lead: always their own club; asking for another club is 403.
 */
function clubScope(user, requestedClubId) {
  if (user.role !== ROLES.CLUB_LEAD) return requestedClubId;
  if (requestedClubId !== null && requestedClubId !== user.clubId) {
    throw new DashboardError(403, 'FORBIDDEN', 'Club Leads can only view their own club');
  }
  return user.clubId;
}

async function getDashboard(user, { status = null, clubId = null, from = null, to = null }) {
  const scopedClub = clubScope(user, clubId);

  // Pipeline counts ignore the status filter so all stages stay visible;
  // the table below uses every filter.
  const [counts, rows, clubs] = await Promise.all([
    dashboardRepo.pipeline({ clubId: scopedClub, from, to }),
    dashboardRepo.listProposals({ clubId: scopedClub, status, from, to }),
    user.role === ROLES.ADMIN ? dashboardRepo.listClubs() : Promise.resolve([]),
  ]);

  const pipeline = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let pendingBudget = 0;
  let approvedBudget = 0;
  counts.forEach((c) => {
    if (!(c.status in pipeline)) return;
    pipeline[c.status] = Number(c.count);
    if (c.status.startsWith('PENDING_')) pendingBudget += Number(c.budget);
    if (c.status === 'APPROVED') approvedBudget += Number(c.budget);
  });

  return {
    pipeline,
    totals: {
      proposals: Object.values(pipeline).reduce((a, b) => a + b, 0),
      pendingBudget,
      approvedBudget,
    },
    proposals: rows.map((p) => ({
      id: p.id,
      eventName: p.event_name,
      clubName: p.club_name,
      eventDate: p.event_date,
      budget: Number(p.budget),
      status: p.status,
      submittedAt: p.created_at,
      // Only meaningful while the proposal is waiting for a decision.
      daysPending: p.status.startsWith('PENDING_') ? Number(p.days_in_status) : null,
    })),
    clubs: clubs.map((c) => ({ id: c.id, name: c.name })),
  };
}

module.exports = { getDashboard, DashboardError, STATUSES };
