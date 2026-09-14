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
  await row.save();

  const minutes = Math.round((now - row.clockIn) / 60000);
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

async function heartbeat(user) {
  const row = await Attendance.findOne({ userId: user._id, date: dayKey() });
  if (!row || row.clockOut) return row;
  row.lastSeen = new Date();
  await row.save();
  return row;
}

module.exports = { dayKey, clockTime, isOnline, clockIn, clockOut, heartbeat, TZ, ONLINE_WINDOW_MS };
