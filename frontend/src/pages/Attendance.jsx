import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { attendanceApi, fetcher } from '../api';
import { AccountAvatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  fmtClock, fmtDayLabel, fmtDuration, isLate, isOnline,
  overtimeMinutes, shiftDay, todayKey, workedMinutes, ON_TIME_BY,
} from '../lib/time';

function SummaryCard({ title, tone, items }) {
  return (
    <div className={`sum-card sum-card--${tone}`}>
      <div className="sum-card-title">
        <span className="sum-card-ico" />
        {title}
      </div>
      <div className="sum-card-items">
        {items.map(i => (
          <div key={i.label} className="sum-item">
            <div className="sum-item-label">{i.label}</div>
            <div className="sum-item-value" style={i.color ? { color: i.color } : undefined}>{i.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todayKey());
  const [search, setSearch] = useState('');
  const [noteDraft, setNoteDraft] = useState(null);

  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const { data } = useSWR(`/attendance?date=${date}`, fetcher, { refreshInterval: 60000 });
  const rows = data?.rows || [];
  const isToday = date === todayKey();

  const merged = useMemo(() => {
    const byUser = new Map(rows.map(r => [String(r.userId), r]));
    return users
      .filter(u => u.active !== false)
      .map(u => ({ user: u, row: byUser.get(String(u._id)) || null }))
      .filter(e => !search || e.user.name.toLowerCase().includes(search.toLowerCase()) || (e.user.username || '').includes(search.toLowerCase()))
      .sort((a, b) => (b.row?.clockIn ? 1 : 0) - (a.row?.clockIn ? 1 : 0) || a.user.name.localeCompare(b.user.name));
  }, [users, rows, search]);

  const present = merged.filter(e => e.row?.clockIn);
  const onTime = present.filter(e => !isLate(e.row));
  const late = present.filter(e => isLate(e.row));
  const working = present.filter(e => !e.row.clockOut);
  const away = working.filter(e => !isOnline(e.row));
  const absent = merged.filter(e => !e.row?.clockIn);
  const noClockOut = present.filter(e => !e.row.clockOut && !isToday);

  async function saveNote(text) {
    try {
      await attendanceApi.note(text);
      toast('Note saved', 'success');
      mutate(`/attendance?date=${date}`);
    } catch (e) {
      toast(e?.response?.data?.error || 'Could not save note', 'error');
    } finally {
      setNoteDraft(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Attendance</h1>
          <p>Clock-in and clock-out records, straight from CRM sign-ins.</p>
        </div>
        <div className="date-nav">
          <button className="date-nav-btn" onClick={() => setDate(d => shiftDay(d, -1))} aria-label="Previous day">‹</button>
          <span className="date-nav-label">{fmtDayLabel(date)}</span>
          <button className="date-nav-btn" onClick={() => setDate(d => shiftDay(d, 1))} disabled={isToday} aria-label="Next day">›</button>
          {!isToday && <button className="btn btn-sm btn-secondary" onClick={() => setDate(todayKey())}>Today</button>}
        </div>
      </div>

      <div className="page-body">
        <div className="sum-grid">
          <SummaryCard
            title="Present Summary"
            tone="green"
            items={[
              { label: `On time (by ${ON_TIME_BY})`, value: onTime.length },
              { label: 'Late clock-in', value: late.length, color: late.length ? '#ea580c' : undefined },
              { label: 'Working now', value: isToday ? working.length : '—' },
            ]}
          />
          <SummaryCard
            title="Not Present Summary"
            tone="blue"
            items={[
              { label: 'Absent', value: absent.length, color: absent.length ? '#dc2626' : undefined },
              { label: 'No clock-out', value: noClockOut.length },
              { label: 'Team size', value: merged.length },
            ]}
          />
          <SummaryCard
            title="Away Summary"
            tone="amber"
            items={[
              { label: 'Idle / away', value: isToday ? away.length : '—' },
              { label: 'Clocked out', value: present.filter(e => e.row.clockOut).length },
              { label: 'Hours logged', value: fmtDuration(present.reduce((a, e) => a + workedMinutes(e.row), 0)) },
            ]}
          />
        </div>

        <div className="toolbar" style={{ margin: '18px 0 12px' }}>
          <div className="search">
            <span className="search-ico">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Employee Name</th>
                <th>Clock-in &amp; Out</th>
                <th>Hours</th>
                <th>Overtime</th>
                <th>Status</th>
                <th style={{ minWidth: 180 }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {merged.map(({ user: u, row }) => {
                const online = isOnline(row);
                const mine = String(u._id) === String(user._id);
                const editing = noteDraft?.id === u._id;
                return (
                  <tr key={u._id}>
                    <td>
                      <div className="cell-user">
                        <AccountAvatar name={u.name} photo={u.photo} size={32} />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-user-name">{u.name}</div>
                          <div className="cell-user-sub">@{u.username} · {u.role}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {row?.clockIn ? (
                        <div className="cell-clock">
                          <span className={isLate(row) ? 'clock-late' : 'clock-ok'}>{fmtClock(row.clockIn)}</span>
                          <span className="cell-clock-sep">—</span>
                          <span className={row.clockOut ? '' : 'clock-running'}>{fmtClock(row.clockOut) || 'running'}</span>
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td>{row?.clockIn ? fmtDuration(workedMinutes(row)) : <span className="text-muted">—</span>}</td>
                    <td>{row?.clockIn && overtimeMinutes(row) > 0 ? fmtDuration(overtimeMinutes(row)) : <span className="text-muted">—</span>}</td>
                    <td>
                      {!row?.clockIn && <span className="tag tag-red">Absent</span>}
                      {row?.clockIn && row.clockOut && <span className="tag tag-gray">Clocked out</span>}
                      {online && <span className="tag tag-green">Online</span>}
                      {row?.clockIn && !row.clockOut && !online && <span className="tag tag-amber">Away</span>}
                    </td>
                    <td>
                      {editing ? (
                        <input
                          autoFocus
                          value={noteDraft.text}
                          placeholder="What are you working on?"
                          onChange={e => setNoteDraft(d => ({ ...d, text: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveNote(noteDraft.text); if (e.key === 'Escape') setNoteDraft(null); }}
                          onBlur={() => saveNote(noteDraft.text)}
                        />
                      ) : (
                        <span
                          className={mine && isToday && row?.clockIn ? 'cell-note editable' : 'cell-note'}
                          onClick={() => mine && isToday && row?.clockIn && setNoteDraft({ id: u._id, text: row.note || '' })}
                        >
                          {row?.note || (mine && isToday && row?.clockIn ? 'Add a note…' : '—')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {merged.length === 0 && (
                <tr><td colSpan={6}><div className="empty" style={{ padding: '28px 0' }}>No employees match that search.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
