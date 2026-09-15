import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api';
import { AccountAvatar } from '../components/AccountPanel';
import { fmtDuration, isOnline, workedMinutes, todayKey, shiftDay, SHIFT_MINUTES } from '../lib/time';

const STATUSES = [
  { id: 'backlog', label: 'Backlog', color: '#3b82f6' },
  { id: 'todo', label: 'To Do', color: '#8b5cf6' },
  { id: 'inprogress', label: 'In Progress', color: '#f59e0b' },
  { id: 'qa', label: 'QA / Review', color: '#06b6d4' },
  { id: 'done', label: 'Done', color: '#10b981' },
  { id: 'cancelled', label: 'Cancelled', color: '#6b7280' },
];

const PRIORITIES = [
  { id: 'high', label: 'High', color: '#f97316' },
  { id: 'medium', label: 'Medium', color: '#eab308' },
  { id: 'low', label: 'Low', color: '#64748b' },
];

const MUTED = '#d4d4d8';
const days = (offset, n) => Array.from({ length: n }, (_, i) => shiftDay(todayKey(), offset + i));
const dayLabel = k => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
const dayTitle = k => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const isOpen = t => t.column !== 'done' && t.column !== 'cancelled';
const nameOf = t => t.assigneeName || t.assignee;

function Legend({ items }) {
  return <ul className="chart-legend">{items.map(i => <li key={i.label}><span className="dot" style={{ background: i.color }} />{i.label}</li>)}</ul>;
}

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

function Panel({ title, sub, onClick, children, bodyClass = '' }) {
  return (
    <section className={`panel${onClick ? ' panel--link' : ''}`} onClick={onClick}>
      <header className="panel-head">
        <h2>{title}</h2>
        <span className="panel-sub">{sub}</span>
      </header>
      <div className={`panel-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

// Stacked vertical bars. rows: { key, label, title, segs: [{ v, color }] }
function ColumnChart({ title, sub, data, legend, onClick }) {
  const max = Math.max(...data.map(d => d.segs.reduce((a, s) => a + s.v, 0)), 1);
  return (
    <Panel title={title} sub={sub} onClick={onClick} bodyClass="col-body">
      <div className="cols">
        {data.map(d => {
          const total = d.segs.reduce((a, s) => a + s.v, 0);
          return (
            <div key={d.key} className="col" title={`${d.title} · ${total}`}>
              <span className="col-val">{total || ''}</span>
              <span className="col-track">
                <span className="col-stack" style={{ height: `${(total / max) * 100}%` }}>
                  {d.segs.map((s, i) => s.v > 0 && <span key={i} style={{ flex: s.v, background: s.color }} />)}
                </span>
              </span>
              <span className="col-label">{d.label}</span>
            </div>
          );
        })}
      </div>
      {legend && <Legend items={legend} />}
    </Panel>
  );
}

// Stacked horizontal bars. rows: { key, label, avatar?, right, segs: [{ v, color }] }
function BarRows({ title, sub, rows, legend, empty, onClick }) {
  const max = Math.max(...rows.map(r => r.segs.reduce((a, s) => a + s.v, 0)), 1);
  return (
    <Panel title={title} sub={sub} onClick={onClick} bodyClass="scroll">
      {rows.length === 0 && <div className="empty">{empty}</div>}
      {rows.map(r => (
        <div key={r.key} className="workload-row">
          {r.avatar}
          <span className="workload-name">{r.label}</span>
          <div className="workload-bar">
            {r.segs.map((s, i) => <span key={i} className="seg" style={{ width: `${(s.v / max) * 100}%`, background: s.color }} />)}
          </div>
          <span className="workload-count">{r.right}</span>
        </div>
      ))}
      {legend && <Legend items={legend} />}
    </Panel>
  );
}

function TaskDonut({ tasks, onClick }) {
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
    <Panel title="Task Distribution" sub={`${total} tasks across the board`} onClick={onClick} bodyClass="donut-body">
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
    </Panel>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: allEvents = [] } = useSWR('/events', fetcher, { revalidateOnFocus: false });
  const { data: tasks = [] } = useSWR('/tasks', fetcher, { revalidateOnFocus: false });
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const { data: attendance } = useSWR('/attendance', fetcher, { refreshInterval: 60000 });

  const today = todayKey();
  const overdue = allEvents.filter(e => e.date < today && e.status !== 'done' && e.status !== 'cancelled').length
    + tasks.filter(t => t.dueDate && t.dueDate < today && t.column !== 'done').length;

  const rows = attendance?.rows || [];
  const online = rows.filter(isOnline).length;
  const present = rows.filter(r => r.clockIn).length;
  const hoursToday = rows.reduce((a, r) => a + workedMinutes(r), 0);

  const inProgress = tasks.filter(t => t.column === 'inprogress').length;
  const done = tasks.filter(t => t.column === 'done').length;
  const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  // 1 — workload per employee
  const workload = users
    .filter(u => u.active !== false)
    .map(u => ({
      user: u,
      open: tasks.filter(t => nameOf(t) === u.name && isOpen(t)).length,
      done: tasks.filter(t => nameOf(t) === u.name && t.column === 'done').length,
    }))
    .filter(d => d.open + d.done > 0)
    .sort((a, b) => b.open - a.open)
    .map(d => ({
      key: d.user._id,
      label: d.user.name,
      avatar: <AccountAvatar name={d.user.name} photo={d.user.photo} size={26} />,
      right: <>{d.open}<span className="text-muted">/{d.open + d.done}</span></>,
      segs: [{ v: d.open, color: '#f97316' }, { v: d.done, color: '#86efac' }],
    }));

  // 2 — throughput, tasks finished per day
  // ponytail: no completedAt on Task, so updatedAt stands in — a late edit to a done task shifts its bar.
  const throughput = days(-6, 7).map(k => ({
    key: k, label: dayLabel(k), title: dayTitle(k),
    segs: [{ v: tasks.filter(t => t.column === 'done' && String(t.updatedAt).slice(0, 10) === k).length, color: '#10b981' }],
  }));

  // 3 — what is booked for the week ahead
  const schedule = days(0, 7).map(k => ({
    key: k, label: dayLabel(k), title: dayTitle(k),
    segs: [
      { v: allEvents.filter(e => e.date === k && e.status !== 'cancelled').length, color: '#3b82f6' },
      { v: tasks.filter(t => t.dueDate === k && isOpen(t)).length, color: '#8b5cf6' },
    ],
  }));

  // 4 — priority mix, overdue called out
  const priority = PRIORITIES.map(p => {
    const of = tasks.filter(t => (t.priority || 'medium') === p.id);
    const late = of.filter(t => isOpen(t) && t.dueDate && t.dueDate < today).length;
    const open = of.filter(isOpen).length - late;
    return {
      key: p.id, label: p.label, right: open + late,
      segs: [{ v: late, color: '#ef4444' }, { v: open, color: p.color }, { v: of.filter(t => t.column === 'done').length, color: MUTED }],
    };
  });

  // 5 — hours clocked today, overtime past the shift
  const hours = rows.filter(r => r.clockIn).map(r => {
    const worked = workedMinutes(r);
    const u = users.find(x => String(x._id) === String(r.userId));
    return {
      key: r._id, label: r.userName || u?.name || 'Unknown',
      avatar: <AccountAvatar name={r.userName || u?.name} photo={u?.photo} size={26} />,
      right: fmtDuration(worked),
      segs: [{ v: Math.min(worked, SHIFT_MINUTES), color: '#16a34a' }, { v: Math.max(0, worked - SHIFT_MINUTES), color: '#f59e0b' }],
    };
  }).sort((a, b) => b.segs[0].v + b.segs[1].v - a.segs[0].v - a.segs[1].v);

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
          <TaskDonut tasks={tasks} onClick={() => navigate('/board')} />
          <BarRows
            title="Workload" sub="Open vs done per employee" rows={workload}
            empty="Nothing assigned yet." onClick={() => navigate('/assigned')}
            legend={[{ label: 'Open', color: '#f97316' }, { label: 'Done', color: '#86efac' }]}
          />
          <ColumnChart
            title="Throughput" sub="Tasks completed, last 7 days" data={throughput}
            onClick={() => navigate('/board')}
          />
          <BarRows
            title="Priority mix" sub="Open work by priority" rows={priority}
            empty="No tasks yet." onClick={() => navigate('/backlog')}
            legend={[{ label: 'Overdue', color: '#ef4444' }, { label: 'Open', color: '#eab308' }, { label: 'Done', color: MUTED }]}
          />
          <BarRows
            title="Hours today" sub={`Clocked time vs ${fmtDuration(SHIFT_MINUTES)} shift`} rows={hours}
            empty="Nobody clocked in yet." onClick={() => navigate('/attendance')}
            legend={[{ label: 'Worked', color: '#16a34a' }, { label: 'Overtime', color: '#f59e0b' }]}
          />
          <ColumnChart
            title="Week ahead" sub="Scheduled events & task due dates" data={schedule}
            onClick={() => navigate('/calendar')}
            legend={[{ label: 'Events', color: '#3b82f6' }, { label: 'Tasks due', color: '#8b5cf6' }]}
          />
        </div>
      </div>
    </div>
  );
}
