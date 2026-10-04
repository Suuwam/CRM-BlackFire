import useSWR from 'swr';
import { fetcher } from '../api';
import { AccountAvatar } from '../components/Avatar';
import { fmtClock, fmtDuration, isOnline, workedMinutes, SHIFT_MINUTES } from '../lib/time';

const STATES = {
  online: { label: 'Online', tone: 'green' },
  away: { label: 'Away', tone: 'amber' },
  out: { label: 'Clocked out', tone: 'blue' },
  offline: { label: 'Offline', tone: 'gray' },
};

function stateOf(row) {
  if (isOnline(row)) return 'online';
  if (row?.clockIn && !row.clockOut) return 'away';
  if (row?.clockOut) return 'out';
  return 'offline';
}

export default function Team() {
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const { data } = useSWR('/attendance', fetcher, { refreshInterval: 30000 });
  const rows = data?.rows || [];
  const byUser = new Map(rows.map(r => [String(r.userId), r]));
  const order = { online: 0, away: 1, out: 2, offline: 3 };

  const people = users
    .filter(u => u.active !== false)
    .map(u => { const row = byUser.get(String(u._id)) || null; return { user: u, row, state: stateOf(row) }; })
    .sort((a, b) => order[a.state] - order[b.state] || a.user.name.localeCompare(b.user.name));
  const count = (s) => people.filter(p => p.state === s).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p>{count('online')} of {people.length} online right now · updates every 30 seconds</p>
        </div>
      </div>
      <div className="page-body">
        <div className="team-summary">
          {Object.entries(STATES).map(([id, s]) => (
            <div key={id} className={`team-summary-item tone-${s.tone}`}>
              <span className="team-summary-dot" />
              <strong>{count(id)}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="team-grid">
          {people.map(({ user: u, row, state }) => {
            const s = STATES[state];
            const mins = row?.clockIn ? workedMinutes(row) : 0;
            return (
              <div key={u._id} className={`team-card tone-${s.tone}`}>
                <div className="team-card-top">
                  <div className="team-avatar-wrap">
                    <AccountAvatar name={u.name} photo={u.photo} size={52} />
                    <span className="team-presence" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="team-name">{u.name}</div>
                    <div className="team-meta">@{u.username} · {u.role}</div>
                  </div>
                  <span className={`team-pill tone-${s.tone}`}>{s.label}</span>
                </div>

                <div className="team-day">
                  <div className="team-day-row">
                    <span>Today</span>
                    <strong>{fmtDuration(mins)}</strong>
                  </div>
                  <div className="team-day-track"><div style={{ width: `${Math.min(100, (mins / SHIFT_MINUTES) * 100)}%` }} /></div>
                  <div className="team-day-row team-day-times">
                    <span>{row?.clockIn ? `In ${fmtClock(row.clockIn)}` : 'Not clocked in'}</span>
                    <span>{row?.clockOut ? `Out ${fmtClock(row.clockOut)}` : row?.clockIn ? 'Still working' : ''}</span>
                  </div>
                </div>
                {row?.note && <div className="team-note">“{row.note}”</div>}
              </div>
            );
          })}
          {people.length === 0 && <div className="empty">No team members yet.</div>}
        </div>
      </div>
    </>
  );
}
