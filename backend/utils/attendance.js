const Attendance = require('../models/Attendance');
const { recordActivity } = require('./activity');

// Single-office timezone — set ATTENDANCE_TZ if the team moves or spreads out.
const TZ = process.env.ATTENDANCE_TZ || 'Asia/Kathmandu';
const ONLINE_WINDOW_MS = 3 * 60 * 1000;   // heartbeat is every 60s, 3 missed = offline

function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

function clockTime(date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(date);
}

function isOnline(row) {
  return !!(row && row.clockIn && !row.clockOut && row.lastSeen && Date.now() - new Date(row.lastSeen).getTime() < ONLINE_WINDOW_MS);
}

async function clockIn(user, source = 'manual') {
  const date = dayKey();
  const now = new Date();
  let row = await Attendance.findOne({ userId: user._id, date });

  if (row && !row.clockOut) {                  // already clocked in — just a heartbeat
    row.lastSeen = now;
    await row.save();
    return row;
  }

  if (row) {                                   // returning after clocking out
    row.clockOut = null;
    row.autoClosed = false;
    row.lastSeen = now;
    await row.save();
  } else {
    try {
      row = await Attendance.create({ userId: user._id, userName: user.name, date, clockIn: now, lastSeen: now });
    } catch (err) {
      if (err.code !== 11000) throw err;       // lost the race, someone else inserted it
      return Attendance.findOne({ userId: user._id, date });
    }
  }

  await recordActivity({
    action: 'clock_in',
    targetType: 'attendance',
    targetId: row._id,
    targetName: user.name,
    actorId: user._id,
    actorName: user.name,
    summary: `${user.name} clocked in at ${clockTime(now)}${source === 'login' ? ' (login)' : ''}`,
  });
  return row;
}

async function clockOut(user, source = 'manual') {
  const date = dayKey();
  const row = await Attendance.findOne({ userId: user._id, date });
  if (!row || !row.clockIn || row.clockOut) return row;

  const now = new Date();
  row.clockOut = now;
  row.lastSeen = now;
  row.autoClosed = false;   // deliberate: a heartbeat must not undo this
  await row.save();

  // Bounded to the row's own day for the same reason the UI is: a clock-out that arrives
  // days after the clock-in must not log a 254-hour shift.
  const dayEnd = new Date(`${row.date}T23:59:59`);
  const end = now > dayEnd ? dayEnd : now;
  const minutes = Math.max(0, Math.round((end - row.clockIn) / 60000));
  await recordActivity({
    action: 'clock_out',
    targetType: 'attendance',
    targetId: row._id,
    targetName: user.name,
    actorId: user._id,
    actorName: user.name,
    summary: `${user.name} clocked out at ${clockTime(now)} after ${Math.floor(minutes / 60)}h ${minutes % 60}m${source === 'logout' ? ' (logout)' : ''}`,
  });
  return row;
}

// A closed tab, a sleeping laptop and a dropped connection all look identical from here:
// the heartbeat stops. That silence is the clock-out signal. There is no goodbye packet
// worth relying on — pagehide does not fire on a crash, a force-quit or a lost network,
// and it *does* fire on an ordinary reload, so acting on it directly would clock people
// out every time they refreshed.
//
// Rows close at their last heartbeat, never at "now", so the silent stretch is never paid
// as work. The grace window is the same one that drives the online dot, which keeps the
// team list and the attendance record from ever disagreeing.
let lastSweep = 0;
const SWEEP_EVERY_MS = 30_000;

async function closeStaleAttendance({ force = false, userId = null } = {}) {
  if (!force && Date.now() - lastSweep < SWEEP_EVERY_MS) return 0;
  if (!userId) lastSweep = Date.now();   // a scoped sweep must not satisfy the global one

  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  const query = {
    clockIn: { $ne: null },
    clockOut: null,
    $or: [
      { lastSeen: { $lt: cutoff } },
      { lastSeen: null, clockIn: { $lt: cutoff } },
    ],
  };
  if (userId) query.userId = userId;   // scoped runs exist so tests cannot touch real rows

  const stale = await Attendance.find(query).limit(200);

  let closed = 0;
  for (const row of stale) {
    const seen = new Date(row.lastSeen || row.clockIn);
    const dayEnd = new Date(`${row.date}T23:59:59`);
    const out = seen > dayEnd ? dayEnd : seen;

    // Conditional on clockOut still being null: two instances sweeping at the same moment
    // must not both close the row and both log it.
    const won = await Attendance.findOneAndUpdate(
      { _id: row._id, clockOut: null },
      { $set: { clockOut: out, autoClosed: true } },
    );
    if (!won) continue;

    closed++;
    const minutes = Math.max(0, Math.round((out - row.clockIn) / 60000));
    await recordActivity({
      action: 'clock_out',
      targetType: 'attendance',
      targetId: row._id,
      targetName: row.userName,
      actorId: row.userId,
      actorName: row.userName,
      summary: `${row.userName} clocked out at ${clockTime(out)} after ${Math.floor(minutes / 60)}h ${minutes % 60}m (disconnected)`,
    });
  }
  return closed;
}

async function heartbeat(user) {
  const row = await Attendance.findOne({ userId: user._id, date: dayKey() });
  if (!row) return row;

  // Reconnecting resumes a day the sweep closed — a dropped connection must not end
  // someone's shift while they are sitting at their desk. A row closed by clicking
  // Clock out stays closed; only autoClosed rows come back.
  //
  // This can only ever reopen the same day's row, because the lookup is keyed on today.
  // A laptop that slept overnight finds no row for today and starts fresh.
  if (row.clockOut && !row.autoClosed) return row;
  if (row.clockOut && row.autoClosed) {
    row.clockOut = null;
    row.autoClosed = false;
  }

  row.lastSeen = new Date();
  await row.save();
  return row;
}

module.exports = { dayKey, clockTime, isOnline, clockIn, clockOut, heartbeat, closeStaleAttendance, TZ, ONLINE_WINDOW_MS };
