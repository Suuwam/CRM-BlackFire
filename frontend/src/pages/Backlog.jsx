import useSWR from 'swr';
import { fetcher } from '../api';

export default function Backlog() {
  const { data: activities = [] } = useSWR('/activity?days=50', fetcher, { revalidateOnFocus: false });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Backlog</h1>
          <p>Activity from the last 50 days.</p>
        </div>
      </div>
      <div className="page-body">
        <div className="card">
          <div className="activity-list" style={{ maxHeight: 'none' }}>
            {activities.length === 0 && <div className="empty" style={{ padding: '24px 0' }}>No recent activity.</div>}
            {activities.map(item => {
              const detailedSentence = item.summary || [
                item.actorName || 'System',
                item.action,
                item.targetName ? `"${item.targetName}"` : '',
                item.fromColumn && item.toColumn ? `from ${item.fromColumn} to ${item.toColumn}` : item.toColumn ? `to ${item.toColumn}` : '',
                item.assigneeName ? `(assigned to ${item.assigneeName})` : '',
              ].filter(Boolean).join(' ');

              return (
                <div key={item._id} className="activity-item">
                  <div className="activity-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`activity-badge badge-${item.action}`}>{item.action}</span>
                      {item.project && <span className="activity-project-tag">{item.project}</span>}
                    </div>
                    <span className="activity-date">{new Date(item.createdAt).toLocaleString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="activity-sentence" style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--text)', marginTop: 8, lineHeight: 1.45 }}>
                    {detailedSentence}
                  </div>
                  <div className="activity-meta" style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 12 }}>
                    <span>By: {item.actorName || 'System'}</span>
                    {item.assigneeName && <span>Assigned to: {item.assigneeName}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
