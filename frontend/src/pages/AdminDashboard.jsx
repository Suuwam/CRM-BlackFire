import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../api';
import { AccountAvatar } from '../components/Avatar';
import { fmtClock, fmtDuration, isLate, isOnline, workedMinutes } from '../lib/time';

const RANGES = [7, 30, 90];

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const { data: today } = useSWR('/attendance', fetcher, { refreshInterval: 60000 });
  const { data: history = [] } = useSWR(`/attendance/history?userId=all&days=${days}`, fetcher, { revalidateOnFocus: false });
  const { data: tasks = [] } = useSWR('/tasks', fetcher, { revalidateOnFocus: false });

  const todayRows = today?.rows || [];
  const onlineNow = todayRows.filter(isOnline).length;
  const presentToday = todayRows.filter(r => r.clockIn).length;

  const stats = useMemo(() => {
    const byUser = new Map();
    history.forEach(r => {
      if (!r.clockIn) return;
      const key = String(r.userId);
      const entry = byUser.get(key) || { minutes: 0, days: 0, late: 0, lastIn: null };
      entry.minutes += workedMinutes(r);
      entry.days += 1;
      if (isLate(r)) entry.late += 1;
      if (!entry.lastIn || new Date(r.clockIn) > new Date(entry.lastIn)) entry.lastIn = r.clockIn;
      byUser.set(key, entry);
    });

    return users
      .filter(u => u.active !== false)
      .map(u => ({
        user: u,
        ...(byUser.get(String(u._id)) || { minutes: 0, days: 0, late: 0, lastIn: null }),
        openTasks: tasks.filter(t => (t.assigneeName || t.assignee) === u.name && t.column !== 'done' && t.column !== 'cancelled').length,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [history, users, tasks]);

  const totalMinutes = stats.reduce((a, s) => a + s.minutes, 0);
  const maxMinutes = Math.max(...stats.map(s => s.minutes), 1);
  const activeDays = new Set(history.filter(r => r.clockIn).map(r => r.date)).size;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin Overview</h1>
          <p>Workforce time, attendance and workload across the team.</p>
        </div>
        <div className="seg-group">
          {RANGES.map(r => (
            <button key={r} className={`seg-btn${days === r ? ' active' : ''}`} onClick={() => setDays(r)}>{r}d</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Online now</div>
            <div className="stat-value">{onlineNow}</div>
            <div className="stat-sub">of {stats.length} employees</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Present today</div>
            <div className="stat-value">{presentToday}</div>
            <div className="stat-sub">{stats.length - presentToday} not clocked in</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Hours · {days}d</div>
            <div className="stat-value">{Math.round(totalMinutes / 60)}</div>
            <div className="stat-sub">{activeDays} active days</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg / employee</div>
            <div className="stat-value">{stats.length ? Math.round(totalMinutes / 60 / stats.length) : 0}</div>
            <div className="stat-sub">hours in range</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Late arrivals</div>
            <div className="stat-value">{stats.reduce((a, s) => a + s.late, 0)}</div>
            <div className="stat-sub">across the range</div>
          </div>
        </div>

        <div className="table-card" style={{ marginTop: 20 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Employee</th>
                <th style={{ minWidth: 180 }}>Time logged</th>
                <th>Days</th>
                <th>Avg / day</th>
                <th>Late</th>
                <th>Open tasks</th>
                <th>Last clock-in</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.user._id}>
                  <td>
                    <div className="cell-user">
                      <AccountAvatar name={s.user.name} photo={s.user.photo} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-user-name">{s.user.name}</div>
                        <div className="cell-user-sub">@{s.user.username} · {s.user.role}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="bar-cell">
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${(s.minutes / maxMinutes) * 100}%` }} /></div>
                      <span className="bar-value">{fmtDuration(s.minutes)}</span>
                    </div>
                  </td>
                  <td>{s.days}</td>
                  <td>{fmtDuration(s.days ? s.minutes / s.days : 0)}</td>
                  <td>{s.late || <span className="text-muted">0</span>}</td>
                  <td>{s.openTasks}</td>
                  <td>{s.lastIn ? `${new Date(s.lastIn).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${fmtClock(s.lastIn)}` : <span className="text-muted">never</span>}</td>
                </tr>
              ))}
              {stats.length === 0 && <tr><td colSpan={7}><div className="empty" style={{ padding: '28px 0' }}>No attendance data yet.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
