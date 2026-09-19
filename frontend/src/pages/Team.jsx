import useSWR from 'swr';
import { fetcher } from '../api';
import { AccountAvatar } from '../components/Avatar';
import { fmtClock, fmtDuration, isOnline, workedMinutes } from '../lib/time';

export default function Team() {
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const { data } = useSWR('/attendance', fetcher, { refreshInterval: 30000 });
  const rows = data?.rows || [];
  const byUser = new Map(rows.map(r => [String(r.userId), r]));

  const people = users
    .filter(u => u.active !== false)
    .map(u => ({ user: u, row: byUser.get(String(u._id)) || null }))
    .map(p => ({ ...p, online: isOnline(p.row) }))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.user.name.localeCompare(b.user.name));

  const onlineCount = people.filter(p => p.online).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p>{onlineCount} of {people.length} online right now</p>
        </div>
      </div>
      <div className="page-body">
        <div className="team-grid">
          {people.map(({ user: u, row, online }) => (
            <div key={u._id} className={`team-card${online ? ' is-online' : ''}`}>
              <div className="team-card-top">
                <div className="team-avatar-wrap">
                  <AccountAvatar name={u.name} photo={u.photo} size={44} />
                  <span className={`presence-dot${online ? ' live' : row?.clockIn && !row.clockOut ? ' away' : ''}`} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="team-name">{u.name}</div>
                  <div className="team-meta">@{u.username} · {u.role}</div>
                </div>
              </div>
              <div className="team-status">
                {online ? 'Online' : row?.clockIn && !row.clockOut ? 'Away' : row?.clockOut ? 'Clocked out' : 'Offline'}
                {row?.clockIn && <span className="text-muted"> · in at {fmtClock(row.clockIn)}</span>}
              </div>
              <div className="team-hours">{row?.clockIn ? fmtDuration(workedMinutes(row)) : '0h 00m'} today</div>
              {row?.note && <div className="team-note">“{row.note}”</div>}
            </div>
          ))}
          {people.length === 0 && <div className="empty">No team members yet.</div>}
        </div>
      </div>
    </>
  );
}
