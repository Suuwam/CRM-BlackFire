import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { attendanceApi, fetcher } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { fmtClock, fmtDuration, workedMinutes } from '../lib/time';

export default function ClockWidget() {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const { data } = useSWR('/attendance', fetcher, { refreshInterval: 60000, revalidateOnFocus: true });
  const row = (data?.rows || []).find(r => String(r.userId) === String(user?._id));
  const running = !!(row?.clockIn && !row.clockOut);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, [running]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (running) {
        const res = await attendanceApi.clockOut();
        toast(`Clocked out · ${fmtDuration(workedMinutes(res.data))} today`, 'success');
      } else {
        await attendanceApi.clockIn();
        toast('Clocked in', 'success');
      }
      mutate('/attendance');
    } catch (e) {
      toast(e?.response?.data?.error || 'Clock action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`clock-widget${running ? ' is-running' : ''}`}
      onClick={toggle}
      disabled={busy}
      title={running ? `Clocked in at ${fmtClock(row.clockIn)} — click to clock out` : 'Click to clock in'}
    >
      <span className={`clock-dot${running ? ' live' : ''}`} />
      <span className="clock-widget-text">
        <span className="clock-widget-label">{running ? 'Clocked in' : row?.clockOut ? 'Clocked out' : 'Clock in'}</span>
        <span className="clock-widget-value">{row?.clockIn ? fmtDuration(workedMinutes(row)) : '--'}</span>
      </span>
    </button>
  );
}
