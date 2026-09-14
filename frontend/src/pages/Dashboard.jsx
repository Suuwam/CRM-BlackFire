import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api';
import { AccountAvatar } from '../components/AccountPanel';
import SocialIcon from '../components/SocialIcon';
import { fmtDuration, isOnline, workedMinutes } from '../lib/time';

const STATUSES = [
  { id: 'backlog', label: 'Backlog', color: '#3b82f6' },
  { id: 'todo', label: 'To Do', color: '#8b5cf6' },
  { id: 'inprogress', label: 'In Progress', color: '#f59e0b' },
  { id: 'qa', label: 'QA / Review', color: '#06b6d4' },
  { id: 'done', label: 'Done', color: '#10b981' },
  { id: 'cancelled', label: 'Cancelled', color: '#6b7280' },
];

function donutPath(cx, cy, radius, innerRadius, startAngle, endAngle) {
  const angleDiff = endAngle - startAngle;
  if (angleDiff <= 0) return '';
  const effectiveEnd = angleDiff >= 359.99 ? startAngle + 359.99 : endAngle;
  const p = (angle, r) => [cx + r * Math.cos((angle - 90) * Math.PI / 180), cy + r * Math.sin((angle - 90) * Math.PI / 180)];
  const [x1, y1] = p(startAngle, radius);
  const [x2, y2] = p(effectiveEnd, radius);
  const [x3, y3] = p(effectiveEnd, innerRadius);
  const [x4, y4] = p(startAngle, innerRadius);
  const largeArc = angleDiff > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

function TaskDonut({ tasks }) {
  const [hovered, setHovered] = useState(null);
  const data = STATUSES.map(s => ({ ...s, value: tasks.filter(t => (t.column || 'backlog') === s.id).length })).filter(d => d.value > 0);
  const total = data.reduce((a, d) => a + d.value, 0);

  let angle = 0;
  const slices = data.map(d => {
    const start = angle;
    angle += total ? (d.value / total) * 360 : 0;
    return { ...d, start, end: angle, pct: total ? Math.round((d.value / total) * 100) : 0 };
  });

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Task Distribution</h2>
        <span className="panel-sub">{total} tasks across the board</span>
      </header>
      <div className="panel-body donut-body">
        {total === 0 ? <div className="empty">No tasks yet.</div> : (
          <>
            <div className="donut-wrap">
              <svg viewBox="0 0 200 200">
                {slices.map((s, i) => (
                  <path
                    key={s.id}
                    d={donutPath(100, 100, hovered === i ? 88 : 82, 52, s.start, s.end)}
                    fill={s.color}
                    opacity={hovered === null || hovered === i ? 1 : 0.4}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </svg>
              <div className="donut-center">
                <strong>{hovered === null ? total : slices[hovered].value}</strong>
                <span>{hovered === null ? 'Total' : slices[hovered].label}</span>
              </div>
            </div>
            <ul className="donut-legend">
              {slices.map((s, i) => (
                <li key={s.id} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} className={hovered === i ? 'on' : ''}>
                  <span className="dot" style={{ background: s.color }} />
                  <span className="legend-label">{s.label}</span>
                  <span className="legend-value">{s.value}</span>
                  <span className="legend-pct">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function Workload({ tasks, users }) {
  const data = users
    .filter(u => u.active !== false)
    .map(u => ({
      user: u,
      open: tasks.filter(t => (t.assigneeName || t.assignee) === u.name && t.column !== 'done' && t.column !== 'cancelled').length,
      done: tasks.filter(t => (t.assigneeName || t.assignee) === u.name && t.column === 'done').length,
    }))
    .filter(d => d.open + d.done > 0)
    .sort((a, b) => b.open - a.open);

  const max = Math.max(...data.map(d => d.open + d.done), 1);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Workload</h2>
        <span className="panel-sub">Open vs done per employee</span>
      </header>
      <div className="panel-body scroll">
        {data.length === 0 && <div className="empty">Nothing assigned yet.</div>}
        {data.map(d => (
          <div key={d.user._id} className="workload-row">
            <AccountAvatar name={d.user.name} photo={d.user.photo} size={26} />
            <span className="workload-name">{d.user.name}</span>
            <div className="workload-bar">
              <span className="seg open" style={{ width: `${(d.open / max) * 100}%` }} />
              <span className="seg done" style={{ width: `${(d.done / max) * 100}%` }} />
            </div>
            <span className="workload-count">{d.open}<span className="text-muted">/{d.open + d.done}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: allEvents = [] } = useSWR('/events', fetcher, { revalidateOnFocus: false });
  const { data: tasks = [] } = useSWR('/tasks', fetcher, { revalidateOnFocus: false });
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const { data: attendance } = useSWR('/attendance', fetcher, { refreshInterval: 60000 });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = allEvents.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12);
  const overdue = allEvents.filter(e => e.date < today && e.status !== 'done' && e.status !== 'cancelled').length
    + tasks.filter(t => t.dueDate && t.dueDate < today && t.column !== 'done').length;

  const rows = attendance?.rows || [];
  const online = rows.filter(isOnline).length;
  const present = rows.filter(r => r.clockIn).length;
  const hoursToday = rows.reduce((a, r) => a + workedMinutes(r), 0);

  const inProgress = tasks.filter(t => t.column === 'inprogress').length;
  const done = tasks.filter(t => t.column === 'done').length;
  const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const fmtDate = d => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="dash-page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Blackfire AI · product, people and delivery at a glance</p>
        </div>
      </div>

      <div className="dash-screen">
        <div className="stats-grid stats-grid--compact">
          <button className="stat-card" onClick={() => navigate('/team')}>
            <div className="stat-label">Online now</div>
            <div className="stat-value">{online}</div>
            <div className="stat-sub">{present} clocked in today</div>
          </button>
          <button className="stat-card" onClick={() => navigate('/attendance')}>
            <div className="stat-label">Hours today</div>
            <div className="stat-value">{fmtDuration(hoursToday)}</div>
            <div className="stat-sub">across the team</div>
          </button>
          <button className="stat-card" onClick={() => navigate('/assigned')}>
            <div className="stat-label">In progress</div>
            <div className="stat-value">{inProgress}</div>
            <div className="stat-sub">active tasks</div>
          </button>
          <button className="stat-card" onClick={() => navigate('/board')}>
            <div className="stat-label">Completion</div>
            <div className="stat-value">{completion}%</div>
            <div className="stat-sub">{done} of {tasks.length} done</div>
          </button>
          <button className={`stat-card${overdue > 0 ? ' stat-card--overdue' : ''}`} onClick={() => navigate('/overdue')}>
            <div className="stat-label">Overdue</div>
            <div className="stat-value" style={{ color: overdue > 0 ? '#ef4444' : undefined }}>{overdue}</div>
            <div className="stat-sub">events &amp; tasks</div>
          </button>
        </div>

        <div className="dash-panels">
          <TaskDonut tasks={tasks} />
          <Workload tasks={tasks} users={users} />
          <section className="panel">
            <header className="panel-head">
              <h2>Upcoming</h2>
              <span className="panel-sub">Next scheduled work</span>
            </header>
            <div className="panel-body scroll">
              {upcoming.length === 0 && <div className="empty">Nothing scheduled.</div>}
              {upcoming.map(ev => (
                <div key={ev._id} className="upcoming-item" onClick={() => navigate('/calendar')}>
                  <span className="up-dot" style={{ background: { blue: '#3b82f6', green: '#10b981', amber: '#f59e0b', purple: '#8b5cf6', red: '#ef4444', pink: '#ec4899' }[ev.color] || '#71717a' }} />
                  <div className="up-info">
                    <div className="up-title">{ev.title}</div>
                    <div className="up-meta">
                      {ev.time && <span>{ev.time}</span>}
                      {(ev.platforms || []).map(p => <SocialIcon key={p} id={p} size={12} />)}
                    </div>
                  </div>
                  <div className="up-date">{fmtDate(ev.date)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
