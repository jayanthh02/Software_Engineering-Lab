const eventRepo = require('../repositories/eventRepo');
const { ROLES } = require('../constants/roles');

// SCP-23 (SCP-F-010): list of approved upcoming events for the Events page.

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

async function listUpcoming(user) {
  const studentId = user.role === ROLES.STUDENT ? user.id : null;
  const rows = await eventRepo.listUpcoming(studentId);

  return rows.map((e) => {
    const capacity = Number(e.expected_attendance);
    const registered = Number(e.registered);
    return {
      id: e.id,
      clubName: e.club_name,
      eventName: e.event_name,
      eventDate: day(e.event_date),
      venue: e.venue,
      description: e.description,
      capacity,
      registered,
      seatsLeft: Math.max(0, capacity - registered),
      registeredByMe: Number(e.mine) > 0,
    };
  });
}

module.exports = { listUpcoming, day };
