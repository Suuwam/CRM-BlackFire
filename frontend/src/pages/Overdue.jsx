import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api';

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Overdue() {
  const navigate = useNavigate();
  const { data: allEvents = [] } = useSWR('/events', fetcher, { revalidateOnFocus: false });
  const { data: tasks = [] } = useSWR('/tasks', fetcher, { revalidateOnFocus: false });

  const today = new Date().toISOString().slice(0, 10);
  const overdueEvents = allEvents
    .filter(e => e.date < today && e.status !== 'done' && e.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date));
  const overdueTasks = tasks
    .filter(t => t.dueDate && t.dueDate < today && t.column !== 'done')
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const total = overdueEvents.length + overdueTasks.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overdue</h1>
          <p>{total === 0 ? 'Nothing is overdue.' : `${total} item${total === 1 ? '' : 's'} past due.`}</p>
        </div>
      </div>
      <div className="page-body">
        {total === 0 ? (
          <div className="card empty" style={{ padding: 32, textAlign: 'center' }}>No overdue events or tasks.</div>
        ) : (
          <div className="upcoming-list">
            {overdueEvents.map(ev => (
              <div key={ev._id} className="upcoming-item overdue-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/calendar')}>
                <div className="up-dot" style={{ background: '#ef4444' }} />
                <div className="up-info">
                  <div className="up-title">{ev.title}</div>
                  <div className="up-meta">
                    <span>Event</span>
                    {ev.clientId?.name && <span>{ev.clientId.name}</span>}
                    <span className="overdue-badge">Overdue</span>
                  </div>
                </div>
                <div className="up-date" style={{ color: '#ef4444' }}>{fmtDate(ev.date)}</div>
              </div>
            ))}
            {overdueTasks.map(t => (
              <div key={t._id} className="upcoming-item overdue-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/board?project=${t.project || 'blackfire'}`)}>
                <div className="up-dot" style={{ background: '#ef4444' }} />
                <div className="up-info">
                  <div className="up-title">{t.title}</div>
                  <div className="up-meta">
                    <span>Task</span>
                    {t.assigneeName && <span>{t.assigneeName}</span>}
                    <span className="overdue-badge">Overdue</span>
                  </div>
                </div>
                <div className="up-date" style={{ color: '#ef4444' }}>{fmtDate(t.dueDate)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
