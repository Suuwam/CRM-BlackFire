import { useState } from 'react';
import useSWR from 'swr';
import { milestonesApi, fetcher } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

const EMPTY = { title: '', description: '' };
const PER_PAGE = 10; // matches the backend page size

const dramatic = { fontFamily: "'Cinzel', 'Georgia', serif", fontWeight: 900, letterSpacing: '.04em' };

export default function Milestones() {
  const { user } = useAuth();
  const canWrite = user?.role === 'admin' || user?.milestoneAccess;
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const { data, mutate } = useSWR(`/milestones?page=${page}`, fetcher, { keepPreviousData: true });
  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;
  // Deleting the last card on a page leaves it empty; step back to the new last page.
  if (data && items.length === 0 && page > 0) setPage(pages - 1);

  function openAdd() { setEditing(null); setForm(EMPTY); setModal(true); }
  function openEdit(m) { setEditing(m._id); setForm({ title: m.title, description: m.description || '' }); setModal(true); }

  async function run(fn, ok) {
    try { await fn(); toast(ok, 'success'); mutate(); }
    catch (e) { toast(e.response?.data?.error || 'Something went wrong', 'error'); }
  }

  async function save() {
    if (!form.title.trim()) return toast('Title is required', 'error');
    await run(() => editing ? milestonesApi.update(editing, form) : milestonesApi.create(form),
      editing ? 'Milestone updated' : 'Milestone created');
    setModal(false);
  }

  function remove(m) {
    if (!confirm(`Delete milestone "${m.title}"?`)) return;
    run(() => milestonesApi.delete(m._id), 'Milestone deleted');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 style={{ ...dramatic, fontSize: 30 }}>Milestones</h1>
          <p>{total} milestone{total === 1 ? '' : 's'} · everyone is notified of changes</p>
        </div>
        {canWrite && <button className="milestone-new" onClick={openAdd}><span>+</span> New Milestone</button>}
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data && items.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', padding: 48 }}>No milestones yet</div>
        )}

        {items.map((m, i) => {
          const number = total - (page * PER_PAGE + i); // oldest is #01
          return (
            <div key={m._id} className="card" style={{ display: 'flex', gap: 24, alignItems: 'center', opacity: m.done ? 0.7 : 1 }}>
              <div style={{ ...dramatic, fontSize: 'clamp(44px, 8vw, 80px)', lineHeight: 1, minWidth: '1.6em', color: m.done ? '#16a34a' : 'var(--text)' }}>
                {String(number).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...dramatic, fontSize: 'clamp(20px, 3vw, 28px)', textDecoration: m.done ? 'line-through' : 'none', wordBreak: 'break-word' }}>
                  {m.title}
                </div>
                {m.description && <div style={{ marginTop: 6, color: 'var(--text2)', whiteSpace: 'pre-wrap', fontSize: 14 }}>{m.description}</div>}
                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text3)' }}>
                  {m.createdByName && `By ${m.createdByName} · `}{new Date(m.createdAt).toLocaleDateString()}
                  {m.done && ` · ✓ Done by ${m.doneByName} on ${new Date(m.doneAt).toLocaleDateString()}`}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className={`btn btn-sm ${m.done ? 'btn-secondary' : 'milestone-done'}`}
                  onClick={() => run(() => milestonesApi.setDone(m._id, !m.done), m.done ? 'Milestone reopened' : 'Milestone done')}>
                  {m.done ? 'Reopen' : 'Mark done'}
                </button>
                {canWrite && <button className="btn btn-sm btn-secondary" onClick={() => openEdit(m)}>Edit</button>}
                {canWrite && <button className="btn btn-sm btn-danger" onClick={() => remove(m)}>Delete</button>}
              </div>
            </div>
          );
        })}

        {pages > 1 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            {Array.from({ length: pages }, (_, p) => (
              <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)}>{p + 1}</button>
            ))}
            <button className="btn btn-sm btn-secondary" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Milestone' : 'New Milestone'}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>{editing ? 'Update' : 'Create'}</button>
          </>
        )}>
        <div className="form-group"><label>Title</label><input value={form.title} maxLength={200} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div className="form-group"><label>Description</label><textarea rows={5} value={form.description} maxLength={5000} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
      </Modal>
    </>
  );
}
