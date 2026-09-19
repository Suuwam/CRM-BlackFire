// Self-check for auto clock-out. Run: node backend/test-auto-clockout.js
// Needs MONGO_URI. Every sweep here is scoped to a throwaway user id and the rows and
// activity it creates are deleted afterwards, so it never touches real attendance.
//
// The rule being pinned: the heartbeat stopping is the clock-out. Silence is never paid
// as work, a dropped connection does not end a shift you are still sitting at, and a
// deliberate Clock out is never undone by a stray ping.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const assert = require('assert');
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const Attendance = require('./models/Attendance');
  const { closeStaleAttendance, heartbeat, clockOut, dayKey, ONLINE_WINDOW_MS } = require('./utils/attendance');

  const uid = new mongoose.Types.ObjectId();
  const user = { _id: uid, name: 'Test Bot' };
  const today = dayKey();
  const ago = ms => new Date(Date.now() - ms);
  const fresh = async (over) => {
    await Attendance.deleteMany({ userId: uid });
    return Attendance.create({ userId: uid, userName: 'Test Bot', date: today, clockIn: ago(4 * 3600_000), lastSeen: ago(4 * 3600_000), ...over });
  };
  const reload = () => Attendance.findOne({ userId: uid });
  // Always scoped to this throwaway user: an unscoped sweep would close real people's rows.
  const sweep = () => closeStaleAttendance({ force: true, userId: uid });

  try {
    // A tab still beating is left alone.
    await fresh({ lastSeen: ago(30_000) });
    await sweep();
    assert.equal((await reload()).clockOut, null, 'a live session must not be closed');

    // Gone quiet past the online window: closed, and closed at the last heartbeat, not now.
    const quietFor = ONLINE_WINDOW_MS + 60_000;
    await fresh({ lastSeen: ago(quietFor) });
    assert.equal(await sweep(), 1);
    let row = await reload();
    assert.ok(row.clockOut, 'a silent session must be closed');
    assert.ok(row.autoClosed, 'and marked as auto-closed');
    assert.ok(Math.abs(row.clockOut - ago(quietFor)) < 2000,
      'must close at lastSeen, not at now — the silence is not work');

    // Sweeping again is a no-op, so the activity log gets one entry, not one per poll.
    assert.equal(await sweep(), 0, 'sweep must be idempotent');

    // Reconnecting the same day resumes: a wifi blip cannot end a shift at your desk.
    row = await heartbeat(user);
    assert.equal(row.clockOut, null, 'reconnecting must resume an auto-closed day');
    assert.equal(row.autoClosed, false);

    // A deliberate Clock out is permanent — a late ping must not reopen it.
    await clockOut(user);
    assert.ok((await reload()).clockOut, 'manual clock-out sets clockOut');
    assert.equal((await reload()).autoClosed, false, 'manual clock-out is not auto-closed');
    await heartbeat(user);
    assert.ok((await reload()).clockOut, 'a heartbeat must NOT undo a manual clock-out');

    // An overnight row cannot be resumed: the heartbeat only ever looks at today.
    await Attendance.deleteMany({ userId: uid });
    const y = await Attendance.create({
      userId: uid, userName: 'Test Bot', date: '2020-01-01',
      clockIn: new Date('2020-01-01T09:00:00Z'), lastSeen: new Date('2020-01-01T17:00:00Z'),
    });
    await sweep();
    let old = await Attendance.findById(y._id);
    assert.ok(old.clockOut, 'an ancient open row gets closed');
    await heartbeat(user);
    old = await Attendance.findById(y._id);
    assert.ok(old.clockOut, 'and today\'s heartbeat must not resurrect yesterday');

    // Whatever the sweep writes, one row still cannot exceed its own day.
    const span = (old.clockOut - old.clockIn) / 60000;
    assert.ok(span <= 24 * 60, `row spans ${span}m; one date cannot exceed 24h`);

    console.log('✓ auto clock-out: silence closes at lastSeen, idempotent, reconnect resumes,');
    console.log('  manual clock-out is final, yesterday stays closed, never over 24h');
  } finally {
    await Attendance.deleteMany({ userId: uid });
    await mongoose.connection.db.collection('activities').deleteMany({ actorId: uid });
    await mongoose.disconnect();
  }
})().catch(e => { console.error('✗', e.message); process.exit(1); });
