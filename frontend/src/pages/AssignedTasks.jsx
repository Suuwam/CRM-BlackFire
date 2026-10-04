import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher, tasksApi } from '../api';
import { AccountAvatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Pager, { usePage } from '../components/Pager';
import { hexOf } from '../components/ColorPicker';

const COL_META = {
  backlog: { label: 'Backlog', color: '#3b82f6' },
  todo: { label: 'To Do', color: '#8b5cf6' },
  inprogress: { label: 'In Progress', color: '#f59e0b' },
  qa: { label: 'QA', color: '#06b6d4' },
  done: { label: 'Done', color: '#10b981' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
};

const PRIORITIES = [
  { id: 'high', label: 'High', color: '#ef4444' },
  { id: 'medium', label: 'Medium', color: '#f59e0b' },
  { id: 'low', label: 'Low', color: '#10b981' },
];

// Open work by difficulty (priority), as a doughnut. Hovering a slice or legend row focuses it.
function PriorityDonut({ tasks }) {
  const [hover, setHover] = useState(null);
  const open = tasks.filter(t => t.column !== 'done' && t.column !== 'cancelled');
  const items = PRIORITIES.map(p => ({ ...p, count: open.filter(t => (t.priority || 'medium') === p.id).length }));
  const total = items.reduce((n, i) => n + i.count, 0);
  const R = 52, C = 2 * Math.PI * R, GAP = total > 1 ? 3 : 0;
  let offset = 0;
  const shown = hover != null ? items[hover] : null;
  return (
    <div className="card assigned-chart-card">
      <div className="assigned-chart-title">Open work by priority</div>
      {total === 0 ? <div className="empty" style={{ padding: '28px 0', textAlign: 'center' }}>No open tasks.</div> : (
        <div className="assigned-donut">
          <div className="assigned-donut-wrap">
            <svg viewBox="0 0 140 140" role="img" aria-label={items.map(i => `${i.label} ${i.count}`).join(', ')}>
              <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface2)" strokeWidth="20" />
              {items.map((it, i) => {
                const len = (it.count / total) * C;
                const seg = it.count ? (
                  <circle key={it.id} cx="70" cy="70" r={R} fill="none" stroke={it.color}
                    strokeWidth={hover === i ? 24 : 20} strokeDasharray={`${Math.max(len - GAP, 0.01)} ${C}`} strokeDashoffset={-offset}
                    transform="rotate(-90 70 70)" opacity={hover == null || hover === i ? 1 : 0.35}
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ transition: 'all .15s', cursor: 'pointer' }} />
                ) : null;
                offset += len;
                return seg;
              })}
            </svg>
            <div className="assigned-donut-center">
              <strong>{shown ? shown.count : total}</strong>
              <span>{shown ? shown.label : 'open'}</span>
            </div>
          </div>
          <ul className="assigned-donut-legend">
            {items.map((it, i) => (
              <li key={it.id} className={hover === i ? 'on' : ''} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <span className="dot" style={{ background: it.color }} />
                <span className="lbl">{it.label}</span>
                <strong>{it.count}</strong>
                <span className="pct">{total ? Math.round((it.count / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Every task by stage, as columns.
function StatusColumns({ tasks }) {
  const [hover, setHover] = useState(null);
  const items = Object.entries(COL_META).map(([id, s]) => ({ id, ...s, count: tasks.filter(t => (t.column || 'backlog') === id).length }));
  const max = Math.max(1, ...items.map(i => i.count));
  return (
    <div className="card assigned-chart-card assigned-chart-card--grow">
      <div className="assigned-chart-title">Status breakdown <span>{tasks.length} task{tasks.length === 1 ? '' : 's'}</span></div>
      {tasks.length === 0 ? <div className="empty" style={{ padding: '28px 0', textAlign: 'center' }}>No tasks assigned.</div> : (
        <div className="assigned-cols">
          {items.map((it, i) => (
            <div key={it.id} className={`assigned-col${hover === i ? ' on' : ''}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              title={`${it.label}: ${it.count} (${Math.round((it.count / tasks.length) * 100)}%)`}>
              <span className="assigned-col-val">{it.count}</span>
              <div className="assigned-col-track">
                <div className="assigned-col-bar" style={{ height: `${(it.count / max) * 100}%`, background: it.color }} />
              </div>
              <span className="assigned-col-lbl">{it.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PRIORITY = { high: { label: 'High', color: '#ef4444' }, medium: { label: 'Medium', color: '#f59e0b' }, low: { label: 'Low', color: '#10b981' } };
const PER_PAGE = 18;

function fmtDue(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AssignedTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [focusUserId, setFocusUserId] = useState('');
  const [taskFilter, setTaskFilter] = useState('open');

  const { data: tasks = [], mutate: mutateTasks } = useSWR('/tasks', fetcher, { revalidateOnFocus: false });
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });
  const { data: boards = [] } = useSWR('/boards', fetcher, { revalidateOnFocus: false });
  const boardOf = (id) => boards.find(b => b._id === id);

  useEffect(() => {
    if (!focusUserId && user?._id) setFocusUserId(String(user._id));
  }, [focusUserId, user]);

  async function quickDoneTask(taskId) {
    mutateTasks(prev => (prev || []).map(t => t._id === taskId ? { ...t, column: 'done' } : t), false);
    toast('Task marked as done', 'success');
    try {
      await tasksApi.move(taskId, 'done');
      mutateTasks();
    } catch {
      toast('Error updating task', 'error');
      mutateTasks();
    }
  }

  const focusUser = users.find(u => String(u._id) === String(focusUserId)) || user;
  const assignedTasks = tasks.filter(t => {
    const taskAssigneeId = String(t.assigneeId || '');
    const taskAssigneeName = t.assigneeName || t.assignee || '';
    if (focusUser?._id && taskAssigneeId && taskAssigneeId === String(focusUser._id)) return true;
    if (focusUser?.email && t.assigneeEmail && t.assigneeEmail === focusUser.email) return true;
    if (focusUser?.name && taskAssigneeName && taskAssigneeName === focusUser.name) return true;
    return false;
  });
  const today = new Date().toISOString().slice(0, 10);
  const openAssigned = assignedTasks.filter(t => t.column !== 'done' && t.column !== 'cancelled');
  const doneAssigned = assignedTasks.filter(t => t.column === 'done');
  const overdue = openAssigned.filter(t => t.dueDate && t.dueDate < today);
  const visibleAssigned = taskFilter === 'open' ? openAssigned : taskFilter === 'done' ? doneAssigned : assignedTasks;
  const pg = usePage(visibleAssigned, PER_PAGE, `${focusUserId}:${taskFilter}`);
  const completion = assignedTasks.length ? Math.round((doneAssigned.length / assignedTasks.length) * 100) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assigned Tasks</h1>
          <p>{user?.role === 'admin' ? 'Pick an account to see what it is working on.' : 'Everything assigned to you, across every board.'}</p>
        </div>
        {user?.role === 'admin' && (
          <select value={focusUserId} onChange={e => setFocusUserId(e.target.value)} style={{ width: 260 }} aria-label="Account">
            {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.username})</option>)}
          </select>
        )}
      </div>
      <div className="page-body page-fit">
        <div className="assigned-top">
          <div className="assigned-person">
            <AccountAvatar name={focusUser?.name || '?'} photo={focusUser?.photo} size={40} />
            <div className="assigned-person-info">
              <div className="assigned-person-name">{focusUser?.name || 'Unassigned'}</div>
              <div className="assigned-person-meta">{focusUser?.email || 'No email on file'}</div>
            </div>
          </div>
          <div className="stats-grid assigned-stats">
            <div className="stat-card"><div className="stat-label">Open</div><div className="stat-value">{openAssigned.length}</div></div>
            <div className="stat-card"><div className="stat-label">Done</div><div className="stat-value">{doneAssigned.length}</div></div>
            <div className={`stat-card${overdue.length ? ' stat-card--overdue' : ''}`}><div className="stat-label">Overdue</div><div className="stat-value" style={{ color: overdue.length ? '#ef4444' : undefined }}>{overdue.length}</div></div>
            <div className="stat-card"><div className="stat-label">Completion</div><div className="stat-value">{completion}%</div></div>
          </div>
        </div>

        <div className="assigned-grid fit-grow">
          <div className="card assigned-list-card" style={{ padding: 16 }}>
            <div className="assigned-filters">
              {[['open', 'Open', openAssigned.length], ['done', 'Done', doneAssigned.length], ['all', 'All', assignedTasks.length]].map(([id, label, n]) => (
                <button key={id} type="button" className={`assigned-filter${taskFilter === id ? ' active' : ''}`} onClick={() => setTaskFilter(id)}>
                  {label} <span className="count">{n}</span>
                </button>
              ))}
            </div>

            <div className="assigned-list scroll-area" key={pg.page}>
              {visibleAssigned.length === 0 && (
                <div className="empty" style={{ padding: '32px 0', textAlign: 'center' }}>
                  {taskFilter === 'open' ? 'No open tasks. Nice.' : taskFilter === 'done' ? 'No completed tasks yet.' : 'No tasks assigned.'}
                </div>
              )}
              {pg.items.map(task => {
                const col = COL_META[task.column] || COL_META.backlog;
                const isDone = task.column === 'done';
                const board = boardOf(task.project);
                const pri = PRIORITY[task.priority] || PRIORITY.medium;
                const late = !isDone && task.dueDate && task.dueDate < today;
                return (
                  <div key={task._id} className={`assigned-item${isDone ? ' is-done' : ''}`} style={{ borderLeft: `4px solid ${hexOf(task.color)}` }}>
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/board?project=${task.project}`)}>
                      <div className="assigned-title" style={{ textDecoration: isDone ? 'line-through' : 'none' }} title={task.title}>{task.title}</div>
                      <div className="assigned-meta">
                        <span className="assigned-pill"><span className="assigned-pill-dot" style={{ background: col.color }} />{col.label}</span>
                        {task.project && (
                          <span className="assigned-pill"><span className="assigned-pill-dot" style={{ background: board?.color || 'var(--text3)' }} />{board?.label || task.project}</span>
                        )}
                        <span className="assigned-pill" style={{ color: pri.color }}>{pri.label}</span>
                        {task.dueDate && (
                          <span className="assigned-pill" style={late ? { background: '#fee2e2', color: '#b91c1c' } : undefined}>
                            {late ? 'Overdue · ' : 'Due '}{fmtDue(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isDone ? (
                      <span className="assigned-done-mark">✓</span>
                    ) : (
                      <button className="assigned-done-btn" aria-label="Mark as done" title="Mark as done" onClick={() => quickDoneTask(task._id)}>✓</button>
                    )}
                  </div>
                );
              })}
            </div>
            <Pager {...pg} />
          </div>

          <div className="assigned-charts">
            <PriorityDonut tasks={assignedTasks} />
            <StatusColumns tasks={assignedTasks} />
          </div>
        </div>
      </div>
    </>
  );
}
