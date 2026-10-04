import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../api';
import { SkeletonRows } from '../components/Skeleton';
import { useDebounced } from '../lib/useDebounced';
import Pager from '../components/Pager';

const PAGE_SIZE = 18;

export default function Backlog() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('');

  // The search runs on the server over the whole log; paging then pages the matches.
  const q = useDebounced(filter, 250).trim();
  useEffect(() => setPage(0), [q]);
  // keepPreviousData holds the current page on screen while the next one loads.
  const { data, isLoading } = useSWR(
    `/activity?days=50&page=${page}&limit=${PAGE_SIZE}&q=${encodeURIComponent(q)}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const slice = data?.items || [];
  const pages = data?.pages || 1;
  const current = Math.min(page, pages - 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Backlog</h1>
          <p>Every sign-in, clock-out and change from the last 50 days.</p>
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
            <input placeholder="Search all activity..." value={filter} onChange={e => setFilter(e.target.value)} />
          </div>
          <span className="text-sm text-muted">{data?.total ?? 0} {q ? (data?.total === 1 ? 'match' : 'matches') : 'entries'}</span>
        </div>

        <div className="activity-list scroll-area" key={current} style={{ maxHeight: 'none' }}>
          {isLoading && !data && <SkeletonRows rows={PAGE_SIZE} />}
          {!isLoading && slice.length === 0 && <div className="empty" style={{ padding: '24px 0' }}>{q ? `Nothing matches "${q}".` : 'No activity found.'}</div>}
          {slice.map(item => {
            const sentence = item.summary || [
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
                    <span className={`activity-badge badge-${item.action}`}>{String(item.action).replace('_', ' ')}</span>
                    {item.project && <span className="activity-project-tag">{item.project}</span>}
                  </div>
                  <span className="activity-date">{new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="activity-sentence">{sentence}</div>
                <div className="activity-meta" style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 12 }}>
                  <span>By: {item.actorName || 'System'}</span>
                  {item.assigneeName && <span>Assigned to: {item.assigneeName}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <Pager page={current} pages={pages} setPage={setPage} />
      </div>
    </>
  );
}
