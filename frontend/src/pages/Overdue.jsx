import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api';
import Pager, { usePage } from '../components/Pager';

function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Overdue() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
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
  const all = [...overdueEvents.map(e => ({ kind: 'event', due: e.date, item: e })), ...overdueTasks.map(t => ({ kind: 'task', due: t.dueDate, item: t }))]
    .sort((a, b) => a.due.localeCompare(b.due));
  // Search every overdue item, then page the matches.
  const q = search.trim().toLowerCase();
  const matches = q ? all.filter(({ kind, item }) =>
    `${item.title} ${kind} ${item.assigneeName || ''} ${item.project || ''}`.toLowerCase().includes(q)) : all;
  const pg = usePage(matches, 18, q);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overdue</h1>
          <p>{total === 0 ? 'Nothing is overdue.' : `${total} item${total === 1 ? '' : 's'} past due.`}</p>
        </div>
      </div>
      <div className="page-body page-fit">
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div className="search">
            <span className="search-ico">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input placeholder="Search all overdue events and tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="text-sm text-muted">{q ? `${matches.length} of ${total}` : `${total} items`}</span>
        </div>
        {total === 0 ? (
          <div className="card empty" style={{ padding: 32, textAlign: 'center' }}>No overdue events or tasks.</div>
        ) : (
          <div className="upcoming-list scroll-area" key={pg.page}>
            {matches.length === 0 && <div className="empty" style={{ padding: '24px 0', textAlign: 'center' }}>Nothing overdue matches "{search.trim()}".</div>}
            {pg.items.map(({ kind, item: ev }) => kind === 'event' ? (
              <div key={ev._id} className="upcoming-item overdue-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/calendar')}>
                <div className="up-dot" style={{ background: '#ef4444' }} />
                <div className="up-info">
                  <div className="up-title">{ev.title}</div>
                  <div className="up-meta">
                    <span>Event</span>
                    <span className="overdue-badge">Overdue</span>
                  </div>
                </div>
                <div className="up-date" style={{ color: '#ef4444' }}>{fmtDate(ev.date)}</div>
              </div>
            ) : (
              <div key={ev._id} className="upcoming-item overdue-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/board?project=${ev.project}`)}>
                <div className="up-dot" style={{ background: '#ef4444' }} />
                <div className="up-info">
                  <div className="up-title">{ev.title}</div>
                  <div className="up-meta">
                    <span>Task</span>
                    {ev.assigneeName && <span>{ev.assigneeName}</span>}
                    <span className="overdue-badge">Overdue</span>
                  </div>
                </div>
                <div className="up-date" style={{ color: '#ef4444' }}>{fmtDate(ev.dueDate)}</div>
              </div>
            ))}
          </div>
        )}
        <Pager {...pg} />
      </div>
    </>
  );
}
