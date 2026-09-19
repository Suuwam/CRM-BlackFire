import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api';
import { AccountAvatar } from '../components/Avatar';
import { SkeletonPanel, SkeletonBlock } from '../components/Skeleton';
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

  // Hovering a slice must not re-tally the whole board.
  const { slices, total } = useMemo(() => {
    const counts = new Map();
    for (const t of tasks) {
      const c = t.column || 'backlog';
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    const data = STATUSES.map(s => ({ ...s, value: counts.get(s.id) || 0 })).filter(d => d.value > 0);
    const sum = data.reduce((a, d) => a + d.value, 0);

    let angle = 0;
    return {
      total: sum,
      slices: data.map(d => {
        const start = angle;
        angle += sum ? (d.value / sum) * 360 : 0;
        return { ...d, start, end: angle, pct: sum ? Math.round((d.value / sum) * 100) : 0 };
      }),
    };
  }, [tasks]);

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
  const { data: tasks = [], isLoading: tasksLoading } = useSWR('/tasks', fetcher, { revalidateOnFocus: false });
  const { data: users = [], isLoading: usersLoading } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const firstLoad = tasksLoading || usersLoading;
  const { data: attendance } = useSWR('/attendance', fetcher, { refreshInterval: 60000 });

  const today = todayKey();

  // Everything below used to run on every render, and the attendance poll re-renders this
  // component once a minute. Workload alone was users x tasks; the whole block is now one
  // pass over each collection, recomputed only when that collection actually changes.
  const taskStats = useMemo(() => {
    const week = days(-6, 7);
    const ahead = days(0, 7);

    const byAssignee = new Map();   // name -> { open, done }
    const doneByDay  = new Map();   // YYYY-MM-DD -> count
    const dueByDay   = new Map();   // YYYY-MM-DD -> open tasks due
    const byPriority = new Map();   // priority -> { open, late, done }

    let inProgress = 0, done = 0, overdueTasks = 0;

    for (const t of tasks) {
      const col = t.column || 'backlog';
      const open = col !== 'done' && col !== 'cancelled';
      const late = open && t.dueDate && t.dueDate < today;

      if (col === 'inprogress') inProgress++;
      if (col === 'done') done++;
      if (t.dueDate && t.dueDate < today && col !== 'done') overdueTasks++;

      const who = nameOf(t);
      if (who) {
        const e = byAssignee.get(who) || { open: 0, done: 0 };
        if (open) e.open++; else if (col === 'done') e.done++;
        byAssignee.set(who, e);
      }

      if (col === 'done' && t.updatedAt) {
        const k = String(t.updatedAt).slice(0, 10);
        doneByDay.set(k, (doneByDay.get(k) || 0) + 1);
      }

      if (open && t.dueDate) dueByDay.set(t.dueDate, (dueByDay.get(t.dueDate) || 0) + 1);

      const pk = t.priority || 'medium';
      const pe = byPriority.get(pk) || { open: 0, late: 0, done: 0 };
      if (late) pe.late++; else if (open) pe.open++;
      if (col === 'done') pe.done++;
      byPriority.set(pk, pe);

      }

    return { week, ahead, byAssignee, doneByDay, dueByDay, byPriority, inProgress, done, overdueTasks };
  }, [tasks, today]);

  const eventStats = useMemo(() => {
    const byDay = new Map();
    let overdueEvents = 0;
    for (const e of allEvents) {
      if (e.date < today && e.status !== 'done' && e.status !== 'cancelled') overdueEvents++;
      if (e.status !== 'cancelled') byDay.set(e.date, (byDay.get(e.date) || 0) + 1);
    }
    return { byDay, overdueEvents };
  }, [allEvents, today]);

  const overdue = eventStats.overdueEvents + taskStats.overdueTasks;
  const { inProgress, done } = taskStats;
  const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const rows = attendance?.rows || [];
  const online = rows.filter(isOnline).length;
  const present = rows.filter(r => r.clockIn).length;
  const hoursToday = rows.reduce((a, r) => a + workedMinutes(r), 0);

  // 1 — workload per employee
  const workload = useMemo(() => users
    .filter(u => u.active !== false)
    .map(u => ({ user: u, ...(taskStats.byAssignee.get(u.name) || { open: 0, done: 0 }) }))
    .filter(d => d.open + d.done > 0)
    .sort((a, b) => b.open - a.open)
    .map(d => ({
      key: d.user._id,
      label: d.user.name,
      avatar: <AccountAvatar name={d.user.name} photo={d.user.photo} size={26} />,
      right: <>{d.open}<span className="text-muted">/{d.open + d.done}</span></>,
      segs: [{ v: d.open, color: '#f97316' }, { v: d.done, color: '#86efac' }],
    })), [users, taskStats]);

  // 2 — throughput, tasks finished per day
  // ponytail: no completedAt on Task, so updatedAt stands in — a late edit to a done task shifts its bar.
  const throughput = useMemo(() => taskStats.week.map(k => ({
    key: k, label: dayLabel(k), title: dayTitle(k),
    segs: [{ v: taskStats.doneByDay.get(k) || 0, color: '#10b981' }],
  })), [taskStats]);

  // 3 — what is booked for the week ahead
  const schedule = useMemo(() => taskStats.ahead.map(k => ({
    key: k, label: dayLabel(k), title: dayTitle(k),
    segs: [
      { v: eventStats.byDay.get(k) || 0, color: '#3b82f6' },
      { v: taskStats.dueByDay.get(k) || 0, color: '#8b5cf6' },
    ],
  })), [taskStats, eventStats]);

  // 4 — priority mix, overdue called out
  const priority = useMemo(() => PRIORITIES.map(p => {
    const e = taskStats.byPriority.get(p.id) || { open: 0, late: 0, done: 0 };
    return {
      key: p.id, label: p.label, right: e.open + e.late,
      segs: [{ v: e.late, color: '#ef4444' }, { v: e.open, color: p.color }, { v: e.done, color: MUTED }],
    };
  }), [taskStats]);

  // 5 — hours clocked today, overtime past the shift.
  // Left out of the memo above on purpose: this is the one panel the 60s attendance poll
  // genuinely changes, so it is the only one that recomputes on a poll.
  const hours = useMemo(() => {
    const photoOf = new Map(users.map(u => [String(u._id), u]));
    return rows.filter(r => r.clockIn).map(r => {
      const worked = workedMinutes(r);
      const u = photoOf.get(String(r.userId));
      return {
        key: r._id, label: r.userName || u?.name || 'Unknown',
        avatar: <AccountAvatar name={r.userName || u?.name} photo={u?.photo} size={26} />,
        right: fmtDuration(worked),
        segs: [{ v: Math.min(worked, SHIFT_MINUTES), color: '#16a34a' }, { v: Math.max(0, worked - SHIFT_MINUTES), color: '#f59e0b' }],
      };
    }).sort((a, b) => b.segs[0].v + b.segs[1].v - a.segs[0].v - a.segs[1].v);
  }, [rows, users]);

  return (
    <div className="dash-page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Blackfire AI · product, people and delivery at a glance</p>
        </div>
      </div>

      {firstLoad ? (
        <div className="dash-screen">
          <div className="stats-grid stats-grid--compact">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="stat-card"><SkeletonBlock w="60%" h={10} /><SkeletonBlock w={54} h={26} style={{ marginTop: 8 }} /><SkeletonBlock w="80%" h={9} style={{ marginTop: 8 }} /></div>
            ))}
          </div>
          <div className="dash-panels">
            {Array.from({ length: 6 }, (_, i) => <SkeletonPanel key={i} />)}
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
