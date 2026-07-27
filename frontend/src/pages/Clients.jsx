import { useState, useRef, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { clientsApi, fetcher } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const EMPTY = { name: '', company: '', email: '', phone: '', status: 'Active', project: '', notes: '' };

// --- Draft cache helpers for Clients ---
const CLIENT_DRAFT_PREFIX = 'crm_client_draft_';
function getClientDraftKey(id) { return CLIENT_DRAFT_PREFIX + (id || 'new'); }
function saveClientDraft(id, formData) {
  try { sessionStorage.setItem(getClientDraftKey(id), JSON.stringify({ form: formData, ts: Date.now() })); } catch {}
}
function loadClientDraft(id) {
  try {
    const raw = sessionStorage.getItem(getClientDraftKey(id));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - d.ts > 86400000) { sessionStorage.removeItem(getClientDraftKey(id)); return null; }
    return d;
  } catch { return null; }
}
function clearClientDraft(id) { try { sessionStorage.removeItem(getClientDraftKey(id)); } catch {} }

export default function Clients() {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('All');
  const [modal, setModal]     = useState(false);
  const [detail, setDetail]   = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const photoRef = useRef();

  const { data: clients = [] } = useSWR('/clients', fetcher, { revalidateOnFocus: false });

  // Auto-save form to sessionStorage while modal is open
  useEffect(() => {
    if (modal) saveClientDraft(editing, form);
  }, [modal, form, editing]);

  function openAdd() {
    const draft = loadClientDraft(null);
    if (draft && draft.form.name.trim()) {
      setForm(draft.form); setEditing(null); setModal(true);
      toast('Restored unsaved draft', 'info');
    } else {
      setForm(EMPTY); setEditing(null); setModal(true);
    }
  }
  function openEdit(c) {
    const draft = loadClientDraft(c._id);
    if (draft && draft.form.name.trim()) {
      setForm(draft.form); setEditing(c._id); setModal(true);
      toast('Restored unsaved edits', 'info');
    } else {
      setForm({ name:c.name,company:c.company,email:c.email,phone:c.phone,status:c.status,project:c.project,notes:c.notes }); setEditing(c._id); setModal(true);
    }
  }

  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    if (!form.name.trim()) return toast('Name is required', 'error');
    setSaving(true);
    try {
      if (editing) {
        mutate('/clients', clients.map(c => c._id === editing ? { ...c, ...form } : c), false);
        await clientsApi.update(editing, form);
        toast('Client updated', 'success');
      } else {
        const res = await clientsApi.create(form);
        mutate('/clients', [...clients, res.data], false);
        toast('Client added', 'success');
      }
      clearClientDraft(editing);
      setModal(false);
      mutate('/clients');
    } catch { toast('Error saving client', 'error'); mutate('/clients'); }
    finally { setSaving(false); }
  }

  async function del(id) {
    mutate('/clients', clients.filter(c => c._id !== id), false);
    toast('Client deleted', 'info');
    if (detail?._id === id) setDetail(null);
    await clientsApi.delete(id);
    mutate('/clients');
  }

  async function uploadPhoto(clientId, file) {
    try {
      await clientsApi.uploadPhoto(clientId, file);
      toast('Photo updated', 'success');
      mutate('/clients');
    } catch { toast('Upload failed', 'error'); }
  }

  const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const visible = clients.filter(c => {
    const matchQ = c.name.toLowerCase().includes(search.toLowerCase()) ||
                   c.company.toLowerCase().includes(search.toLowerCase());
    const matchF = filter === 'All' || c.status === filter;
    return matchQ && matchF;
  });

  return (
    <>
      <div className="page-head">
        <div><h1>Clients</h1><p>Manage your client relationships</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Client</button>
      </div>
      <div className="page-body">
        <div className="toolbar">
          <div className="search">
            <span className="search-ico">🔍</span>
            <input placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {['All','Active','Prospect','Inactive'].map(s => (
            <button key={s} className={`btn btn-sm ${filter===s?'btn-primary':'btn-secondary'}`} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>

        <div className="clients-grid">
          {visible.map(c => (
            <div key={c._id} className="client-card" onClick={() => setDetail(c)}>
              <div className="client-top">
                <div className="avatar">
                  {c.photo
                    ? <img src={c.photo.startsWith('data:') || c.photo.startsWith('http') ? c.photo : `/uploads/${c.photo}`} alt={c.name} />
                    : initials(c.name)
                  }
                  <label className="add-photo-btn" title="Upload photo" onClick={e => { e.stopPropagation(); photoRef.current.dataset.id = c._id; photoRef.current.click(); }}>+</label>
                </div>
                <div>
                  <div className="client-name">{c.name}</div>
                  <div className="client-co">{c.company}</div>
                </div>
              </div>
              <div className="text-sm text-muted truncate">{c.email}</div>
              <div className="client-foot">
                <span className={`tag status-${c.status}`}>{c.status}</span>
                <div style={{ display:'flex', gap:4 }}>
                  <button className="btn-icon btn-sm" onClick={e => { e.stopPropagation(); openEdit(c); }}>✏️</button>
                  <button className="btn-icon btn-sm" onClick={e => { e.stopPropagation(); del(c._id); }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
          {visible.length === 0 && <div className="empty"><div className="empty-ico">👤</div><p>No clients found</p></div>}
        </div>
      </div>

      {/* Hidden file input for photo */}
      <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }}
        onChange={e => { if (e.target.files[0]) uploadPhoto(e.target.dataset.id, e.target.files[0]); e.target.value=''; }} />

      {/* Add/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Client' : 'Add Client'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
        <div className="form-row">
          <div className="form-group"><label>Name *</label><input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} placeholder="Full name" /></div>
          <div className="form-group"><label>Company</label><input value={form.company} onChange={e => setForm(f => ({...f, company:e.target.value}))} placeholder="Company name" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} placeholder="email@example.com" /></div>
          <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} placeholder="+977..." /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({...f, status:e.target.value}))}>
              <option>Active</option><option>Prospect</option><option>Inactive</option>
            </select>
          </div>
          <div className="form-group"><label>Project</label><input value={form.project} onChange={e => setForm(f => ({...f, project:e.target.value}))} placeholder="Current project" /></div>
        </div>
        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({...f, notes:e.target.value}))} placeholder="Any notes about this client..." /></div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Client Detail" large
        footer={<><button className="btn btn-secondary" onClick={() => { openEdit(detail); setDetail(null); }}>Edit</button><button className="btn btn-danger" onClick={() => del(detail._id)}>Delete</button></>}>
        {detail && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:4 }}>
              <div className="avatar" style={{ width:52, height:52, fontSize:18 }}>
                {detail.photo ? <img src={detail.photo.startsWith('data:') || detail.photo.startsWith('http') ? detail.photo : `/uploads/${detail.photo}`} alt={detail.name} /> : initials(detail.name)}
              </div>
              <div>
                <div style={{ fontSize:16, fontWeight:650 }}>{detail.name}</div>
                <div className="text-muted text-sm">{detail.company}</div>
                <span className={`tag status-${detail.status}`} style={{ marginTop:4, display:'inline-flex' }}>{detail.status}</span>
              </div>
            </div>
            <div className="divider" />
            <div className="form-row">
              <div><div className="text-muted text-sm">Email</div><div className="text-sm">{detail.email||'—'}</div></div>
              <div><div className="text-muted text-sm">Phone</div><div className="text-sm">{detail.phone||'—'}</div></div>
            </div>
            <div><div className="text-muted text-sm">Project</div><div className="text-sm">{detail.project||'—'}</div></div>
            {detail.notes && <div><div className="text-muted text-sm">Notes</div><div className="text-sm" style={{ whiteSpace:'pre-wrap' }}>{detail.notes}</div></div>}
          </>
        )}
      </Modal>
    </>
  );
}
