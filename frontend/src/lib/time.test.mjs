// Self-check for attendance time accounting. Run:
//   node frontend/src/lib/time.test.mjs
// The invariant that matters: one row covers one date, so it can never report more than
// 24h. A forgotten clock-out used to accrue from clock-in until whenever you looked,
// which is how four shifts showed as 254h 50m / 63h per day.
import assert from 'node:assert';
import { workedMinutes, overtimeMinutes, fmtDuration } from './time.js';

const HOUR = 60;
const at = (date, hhmm) => new Date(`${date}T${hhmm}:00`).toISOString();
const DAY = '2026-09-10';

// A normal, closed shift.
assert.equal(workedMinutes({ date: DAY, clockIn: at(DAY, '09:00'), clockOut: at(DAY, '17:30') }), 8 * HOUR + 30);

// Open row, still online: counts up to now.
const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
const today = new Intl.DateTimeFormat('en-CA').format(new Date());
const live = workedMinutes({ date: today, clockIn: fiveMinAgo, lastSeen: new Date().toISOString() });
assert.ok(live >= 4 && live <= 6, `live row should read ~5m, read ${live}`);

// Open row, gone offline: stops at the last heartbeat, not at now.
assert.equal(
  workedMinutes({ date: DAY, clockIn: at(DAY, '09:00'), lastSeen: at(DAY, '13:00') }),
  4 * HOUR,
  'an abandoned row must stop at lastSeen',
);

// The bug from the screenshot: clocked in, never clocked out, heartbeat ran on past
// midnight because a tab was left open. Must still be capped to that row's own day.
const runaway = workedMinutes({ date: DAY, clockIn: at(DAY, '09:00'), lastSeen: at('2026-09-20', '11:00') });
assert.ok(runaway <= 24 * HOUR, `a single row reported ${fmtDuration(runaway)}; must never exceed 24h`);
assert.equal(runaway, 15 * HOUR);   // 09:00 -> end of that same day

// A late clock-out is bounded the same way.
const lateOut = workedMinutes({ date: DAY, clockIn: at(DAY, '09:00'), clockOut: at('2026-09-14', '09:00') });
assert.ok(lateOut <= 24 * HOUR, `late clock-out reported ${fmtDuration(lateOut)}`);

// No evidence of any work at all.
assert.equal(workedMinutes({ date: DAY, clockIn: at(DAY, '09:00') }), 0, 'no lastSeen, no clockOut => 0');
assert.equal(workedMinutes({ date: DAY }), 0);
assert.equal(workedMinutes(null), 0);

// Clocks that run backwards never produce a negative.
assert.equal(workedMinutes({ date: DAY, clockIn: at(DAY, '17:00'), clockOut: at(DAY, '09:00') }), 0);

// Overtime rides on the same bound, so it cannot blow up either.
assert.equal(overtimeMinutes({ date: DAY, clockIn: at(DAY, '09:00'), clockOut: at(DAY, '19:00') }), 2 * HOUR);
assert.ok(overtimeMinutes({ date: DAY, clockIn: at(DAY, '09:00'), lastSeen: at('2026-09-20', '11:00') }) <= 24 * HOUR);

// The averages in the admin table are minutes/days, so bounding each row bounds the mean.
const rows = [
  { date: '2026-09-07', clockIn: at('2026-09-07', '09:00'), clockOut: at('2026-09-07', '17:00') },
  { date: '2026-09-08', clockIn: at('2026-09-08', '09:00'), lastSeen: at('2026-09-30', '09:00') }, // forgotten
  { date: '2026-09-09', clockIn: at('2026-09-09', '10:00'), clockOut: at('2026-09-09', '18:00') },
];
const total = rows.reduce((a, r) => a + workedMinutes(r), 0);
const avgPerDay = total / rows.length;
assert.ok(avgPerDay <= 24 * HOUR, `avg/day came out as ${fmtDuration(avgPerDay)} — impossible`);

assert.equal(fmtDuration(254 * HOUR + 50), '254h 50m');   // formatter itself was never wrong

console.log('✓ attendance time: closed, live, abandoned and forgotten rows all bounded to their own day');
