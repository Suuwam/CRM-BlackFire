import { useEffect, useState, useRef } from 'react';
import { clientsApi } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const EMPTY = { name: '', company: '', email: '', phone: '', status: 'Active', project: '', notes: '' };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('All');
  const [modal, setModal]     = useState(false);
  const [detail, setDetail]   = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const toast = useToast();
  const photoRef = useRef();

  async function load() {
    const r = await clientsApi.list();
    setClients(r.data);
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(c) { setForm({ name:c.name,company:c.company,email:c.email,phone:c.phone,status:c.status,project:c.project,notes:c.notes }); setEditing(c._id); setModal(true); }

  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    if (!form.name.trim()) return toast('Name is required', 'error');
    setSaving(true);
    try {
      if (editing) { await clientsApi.update(editing, form); toast('Client updated', 'success'); }
      else         { await clientsApi.create(form); toast('Client added', 'success'); }
      setModal(false); load();
    } catch { toast('Error saving client', 'error'); }
    finally { setSaving(false); }
  }

  async function del(id) {
    await clientsApi.delete(id);
    toast('Client deleted', 'info');
    load();
    if (detail?._id === id) setDetail(null);
  }

  async function uploadPhoto(clientId, file) {
    try {
      await clientsApi.uploadPhoto(clientId, file);
      toast('Photo updated', 'success');
      load();
      if (detail) setDetail(c => clients.find(x => x._id === clientId) || c);
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
                {detail.photo ? <img src={`/uploads/${detail.photo}`} alt={detail.name} /> : initials(detail.name)}
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
