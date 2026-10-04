import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher, tasksApi } from '../api';
import { AccountAvatar } from '../components/Avatar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Pager, { usePage } from '../components/Pager';

const COL_META = {
  backlog: { label: 'Backlog', color: '#3b82f6' },
  todo: { label: 'To Do', color: '#8b5cf6' },
  inprogress: { label: 'In Progress', color: '#f59e0b' },
  qa: { label: 'QA', color: '#06b6d4' },
  done: { label: 'Done', color: '#10b981' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
};

function AssignedTaskBarChart({ tasks = [] }) {
  const [metric, setMetric] = useState('status');
  const [hoveredId, setHoveredId] = useState(null);
  const totalAssigned = tasks.length;
  if (totalAssigned === 0) return null;

  let items = [];
  if (metric === 'status') {
    items = Object.entries(COL_META).map(([id, s]) => ({
      id,
      ...s,
      count: tasks.filter(t => (t.column || 'backlog') === id).length,
    }));
  } else {
    const priorities = [
      { id: 'high', label: 'High Priority', color: '#ef4444' },
      { id: 'medium', label: 'Medium Priority', color: '#f59e0b' },
      { id: 'low', label: 'Low Priority', color: '#10b981' },
    ];
    items = priorities.map(p => ({
      ...p,
      count: tasks.filter(t => (t.priority || 'medium') === p.id).length,
    }));
  }

  const maxVal = Math.max(...items.map(i => i.count), 1);

  return (
    <div className="card assigned-chart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{metric === 'status' ? 'Status' : 'Priority'} breakdown</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn btn-sm ${metric === 'status' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetric('status')} style={{ fontSize: 10, padding: '2px 7px' }}>Status</button>
          <button className={`btn btn-sm ${metric === 'priority' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetric('priority')} style={{ fontSize: 10, padding: '2px 7px' }}>Priority</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => {
          const barW = (item.count / maxVal) * 100;
          const pct = Math.round((item.count / totalAssigned) * 100);
          return (
            <div
              key={item.id}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 6px', borderRadius: 6, background: hoveredId === item.id ? 'var(--surface)' : 'transparent' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 600, minWidth: 104 }}>{item.label}</span>
              <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${barW}%`, background: item.color, borderRadius: 99 }} />
              </div>
              <span style={{ fontWeight: 750, minWidth: 48, textAlign: 'right' }}>{item.count} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PRIORITY = { high: { label: 'High', color: '#ef4444' }, medium: { label: 'Medium', color: '#f59e0b' }, low: { label: 'Low', color: '#10b981' } };
const PER_PAGE = 8;

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
      <div className="page-body">
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

        <div className="assigned-grid">
          <div className="card" style={{ padding: 16 }}>
            <div className="assigned-filters">
              {[['open', 'Open', openAssigned.length], ['done', 'Done', doneAssigned.length], ['all', 'All', assignedTasks.length]].map(([id, label, n]) => (
                <button key={id} type="button" className={`assigned-filter${taskFilter === id ? ' active' : ''}`} onClick={() => setTaskFilter(id)}>
                  {label} <span className="count">{n}</span>
                </button>
              ))}
            </div>

            <div className="assigned-list">
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
                  <div key={task._id} className={`assigned-item card-color-${task.color || 'blue'}${isDone ? ' is-done' : ''}`}>
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

          <AssignedTaskBarChart tasks={assignedTasks} />
        </div>
      </div>
    </>
  );
}
