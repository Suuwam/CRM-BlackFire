import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher, tasksApi } from '../api';
import { AccountAvatar } from '../components/AccountPanel';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

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
    <div className="assigned-chart-card" style={{ marginTop: 16, padding: 16, background: 'var(--surface2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Status breakdown</div>
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
              <span style={{ fontWeight: 600, minWidth: 90 }}>{item.label}</span>
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

export default function AssignedTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [focusUserId, setFocusUserId] = useState('');
  const [taskFilter, setTaskFilter] = useState('open');

  const { data: tasks = [], mutate: mutateTasks } = useSWR('/tasks', fetcher, { revalidateOnFocus: false });
  const { data: users = [] } = useSWR('/users', fetcher, { revalidateOnFocus: false });

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
  const openAssigned = assignedTasks.filter(t => t.column !== 'done' && t.column !== 'cancelled');
  const doneAssigned = assignedTasks.filter(t => t.column === 'done');
  const visibleAssigned = taskFilter === 'open' ? openAssigned : taskFilter === 'done' ? doneAssigned : assignedTasks;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assigned Tasks</h1>
          <p>{user?.role === 'admin' ? 'Tasks for the selected account.' : 'Your assigned tasks.'}</p>
        </div>
      </div>
      <div className="page-body">
        {user?.role === 'admin' && (
          <div className="form-group" style={{ marginBottom: 16, maxWidth: 360 }}>
            <label>Account</label>
            <select value={focusUserId} onChange={e => setFocusUserId(e.target.value)}>
              {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.username})</option>)}
            </select>
          </div>
        )}

        <div className="assigned-person" style={{ maxWidth: 480, marginBottom: 16 }}>
          <AccountAvatar name={focusUser?.name || '?'} size={34} />
          <div className="assigned-person-info">
            <div className="assigned-person-name">{focusUser?.name || 'Unassigned'}</div>
            <div className="assigned-person-meta">{focusUser?.email || 'No email on file'}</div>
          </div>
        </div>

        <div className="assigned-filters">
          <button type="button" className={`assigned-filter${taskFilter === 'open' ? ' active' : ''}`} onClick={() => setTaskFilter('open')}>
            Open <span className="count">{openAssigned.length}</span>
          </button>
          <button type="button" className={`assigned-filter${taskFilter === 'done' ? ' active' : ''}`} onClick={() => setTaskFilter('done')}>
            Done <span className="count">{doneAssigned.length}</span>
          </button>
          <button type="button" className={`assigned-filter${taskFilter === 'all' ? ' active' : ''}`} onClick={() => setTaskFilter('all')}>
            All <span className="count">{assignedTasks.length}</span>
          </button>
        </div>

        <div className="assigned-list" style={{ maxWidth: 720 }}>
          {visibleAssigned.length === 0 && (
            <div className="empty" style={{ padding: '24px 0' }}>
              {taskFilter === 'open' ? 'No open tasks.' : taskFilter === 'done' ? 'No completed tasks.' : 'No tasks assigned.'}
            </div>
          )}
          {visibleAssigned.map(task => {
            const col = COL_META[task.column] || COL_META.backlog;
            const isDone = task.column === 'done';
            return (
              <div key={task._id} className={`assigned-item${isDone ? ' is-done' : ''}`}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/board?project=${task.project || 'blackfire'}`)}>
                  <div className="assigned-title" style={{ textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</div>
                  <div className="assigned-meta">
                    <span className="assigned-pill">
                      <span className="assigned-pill-dot" style={{ background: col.color }} />
                      {col.label}
                    </span>
                    {task.project && <span className="assigned-pill">{task.project}</span>}
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

        <div style={{ maxWidth: 720 }}>
          <AssignedTaskBarChart tasks={assignedTasks} />
        </div>
      </div>
    </>
  );
}
