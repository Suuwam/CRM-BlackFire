import { useState } from 'react';
import useSWR from 'swr';
import api, { fetcher } from '../api';
import { useToast } from './Toast';

const fmtBytes = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(0, Math.round(b / 1024))} KB`);
const LABEL = {
  'activity-log': 'activity log', attendance: 'attendance days', 'calendar-events': 'calendar events',
  'feedback-reviews': 'feedback reviews', 'tasks-closed': 'closed tasks', 'milestones-done': 'done milestones',
  'account-requests-reviewed': 'reviewed sign-up requests',
};

// Admin Overview: database usage vs the plan limit, and one button that downloads a ZIP of
// everything older than six months and, only once that ZIP is saved, deletes it.
export default function StorageCard() {
  const toast = useToast();
  const { data, mutate } = useSWR('/admin/storage', fetcher, { revalidateOnFocus: false });
  const [busy, setBusy] = useState('');
  if (!data) return <div className="card storage-card storage-card--loading">Checking storage…</div>;

  const pct = Math.min(100, (data.usedBytes / data.limitBytes) * 100);
  const level = pct >= 90 ? 'critical' : pct >= 70 ? 'warn' : 'ok';
  const before = new Date(data.old.before);
  const beforeLabel = before.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const oldList = data.old.items.filter(i => i.count).map(i => `${i.count} ${LABEL[i.file] || i.file}`).join(', ');

  async function archive() {
    if (!confirm(`Download a ZIP of ${data.old.total} records from before ${beforeLabel} (${oldList})?\n\nYou'll be asked again before anything is deleted.`)) return;
    setBusy('Preparing ZIP…');
    try {
      const res = await api.get('/admin/archive', { params: { before: data.old.before }, responseType: 'blob' });
      const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || 'blackfire-crm-archive.zip';
      const url = URL.createObjectURL(res.data);
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      const count = Number(res.headers['x-archive-count'] || data.old.total);
      setBusy('');
      if (!confirm(`Saved ${name} (${count} records, ${fmtBytes(res.data.size)}).\n\nDelete these ${count} records from the CRM now? This can't be undone. Keep the ZIP safe.`)) {
        toast('ZIP downloaded. Nothing was deleted.', 'info');
        return;
      }
      setBusy('Deleting…');
      const del = await api.post('/admin/archive/delete', { before: data.old.before });
      toast(`Deleted ${del.data.total} old records`, 'success');
      mutate();
    } catch (e) {
      // A blob error body has to be read before it can be shown.
      let msg = e.response?.data?.error;
      if (!msg && e.response?.data instanceof Blob) { try { msg = JSON.parse(await e.response.data.text()).error; } catch {} }
      toast(msg || 'Archive failed. Nothing was deleted.', 'error');
    } finally { setBusy(''); }
  }

  return (
    <div className="card storage-card">
      <div className="storage-main">
        <div className="storage-head">
          <span className="stat-label">CRM storage</span>
          <span className={`storage-badge storage-badge--${level}`}>
            {level === 'ok' ? 'Healthy' : level === 'warn' ? 'Filling up' : 'Almost full'}
          </span>
        </div>
        <div className="storage-numbers">
          <strong>{fmtBytes(data.usedBytes)}</strong> used of {fmtBytes(data.limitBytes)}
          <span className="storage-left"> · {fmtBytes(Math.max(0, data.limitBytes - data.usedBytes))} left ({(100 - pct).toFixed(1)}%)</span>
        </div>
        <div className="storage-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Storage used">
          <div className={`storage-fill storage-fill--${level}`} style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>
        <div className="storage-top">
          {data.collections.slice(0, 4).map(c => <span key={c.name}>{c.name} {fmtBytes(c.bytes)}</span>)}
        </div>
      </div>
      <div className="storage-action">
        <div className="storage-old">
          {data.old.total ? <><strong>{data.old.total.toLocaleString()}</strong> records older than 6 months</> : 'Nothing older than 6 months'}
        </div>
        <button className="btn btn-sm btn-secondary" disabled={!data.old.total || !!busy} onClick={archive}
          title={data.old.total ? `Before ${beforeLabel}: ${oldList}` : 'Nothing to archive yet'}>
          {busy || 'Download ZIP & delete'}
        </button>
      </div>
    </div>
  );
}
