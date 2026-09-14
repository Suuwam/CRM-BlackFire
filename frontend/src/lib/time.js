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

export function workedMinutes(row) {
  if (!row?.clockIn) return 0;
  const end = row.clockOut ? new Date(row.clockOut) : new Date();
  return Math.max(0, Math.round((end - new Date(row.clockIn)) / 60000));
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
