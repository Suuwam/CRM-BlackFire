// Shared attendance/time formatting. Dates come from the API as ISO strings.

export const ONLINE_WINDOW_MS = 3 * 60 * 1000;
export const SHIFT_MINUTES = Number(import.meta.env?.VITE_SHIFT_MINUTES || 480); // 8h day — tune per policy
export const ON_TIME_BY = import.meta.env?.VITE_ON_TIME_BY || '09:30';           // late after this

export function todayKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA').format(d); // YYYY-MM-DD, browser local
}

export function shiftDay(key, delta) {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return todayKey(d);
}

export function fmtClock(value) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtDayLabel(key) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

// When does a day's work stop counting?
//
//   clocked out        -> the clock-out
//   still online now   -> now, so the live counter keeps ticking
//   open but offline   -> lastSeen, the last heartbeat we actually observed
//
// and never past the end of the row's own day. Without that last bound a forgotten
// clock-out accrued from the moment of clock-in until whenever you happened to look:
// four shifts read as 254h, an average of 63h per day. A row covers one date, so it can
// never legitimately exceed 24h.
export function workedMinutes(row) {
  if (!row?.clockIn) return 0;

  const start = new Date(row.clockIn);
  let end;
  if (row.clockOut)      end = new Date(row.clockOut);
  else if (isOnline(row)) end = new Date();
  else if (row.lastSeen)  end = new Date(row.lastSeen);
  else                    return 0;   // clocked in, never seen again: no evidence of work

  const dayEnd = row.date ? new Date(`${row.date}T23:59:59`) : null;
  if (dayEnd && !isNaN(dayEnd) && end > dayEnd) end = dayEnd;

  return Math.max(0, Math.round((end - start) / 60000));
}

export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function isOnline(row) {
  return !!(row?.clockIn && !row.clockOut && row.lastSeen && Date.now() - new Date(row.lastSeen).getTime() < ONLINE_WINDOW_MS);
}

export function isLate(row) {
  if (!row?.clockIn) return false;
  const [h, m] = ON_TIME_BY.split(':').map(Number);
  const start = new Date(row.clockIn);
  return start.getHours() * 60 + start.getMinutes() > h * 60 + m;
}

export function overtimeMinutes(row) {
  return Math.max(0, workedMinutes(row) - SHIFT_MINUTES);
}
