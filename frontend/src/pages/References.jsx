import { useEffect, useState } from 'react';
import { referencesApi } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const EMPTY = { title:'', url:'', tags:'', notes:'' };

export default function References() {
  const [refs, setRefs]       = useState([]);
  const [search, setSearch]   = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  async function load() { const r = await referencesApi.list(); setRefs(r.data); }
  useEffect(() => { load(); }, []);

  function openAdd()   { setForm(EMPTY); setEditing(null); setModal(true); }
  function openEdit(r) { setForm({ title:r.title, url:r.url, tags:(r.tags||[]).join(', '), notes:r.notes }); setEditing(r._id); setModal(true); }

  async function save() {
    if (!form.title.trim() || !form.url.trim()) return toast('Title and URL required', 'error');
    const data = { ...form, tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean) };
    try {
      if (editing) await referencesApi.update(editing, data);
      else         await referencesApi.create(data);
      toast('Saved', 'success'); setModal(false); load();
    } catch { toast('Error', 'error'); }
  }

  async function del(id) {
    if (!confirm('Delete?')) return;
    await referencesApi.delete(id); toast('Deleted', 'success'); load();
  }

  // All unique tags
  const allTags = [...new Set(refs.flatMap(r => r.tags || []))].sort();

  const visible = refs.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || r.title.toLowerCase().includes(q) || r.url.toLowerCase().includes(q);
    const matchT = !tagFilter || (r.tags || []).includes(tagFilter);
    return matchQ && matchT;
  });

  function hostname(url) { try { return new URL(url).hostname; } catch { return url; } }

  return (
    <>
      <div className="page-head">
        <div><h1>References</h1><p>Curated links and resources</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Link</button>
      </div>
      <div className="page-body">
        <div className="toolbar">
          <div className="search">
            <span className="search-ico">🔍</span>
            <input placeholder="Search links..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="ref-tags" style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            <button className={`ref-tag${!tagFilter?' on':''}`} onClick={() => setTagFilter('')}>All</button>
            {allTags.map(t => (
              <button key={t} className={`ref-tag${tagFilter===t?' on':''}`} onClick={() => setTagFilter(tagFilter===t?'':t)}>{t}</button>
            ))}
          </div>
        </div>

        <div className="ref-grid">
          {visible.map(r => (
            <div key={r._id} className="ref-card">
              <div className="ref-title">{r.title}</div>
              <div className="ref-url">{hostname(r.url)}</div>
              {r.notes && <div className="ref-notes">{r.notes}</div>}
              <div className="ref-tags">
                {(r.tags||[]).map(t => <span key={t} className="ref-tag" onClick={() => setTagFilter(t)}>{t}</span>)}
              </div>
              <div className="ref-foot">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">↗ Open</a>
                <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText(r.url); toast('Copied!', 'success'); }}>📋</button>
                <button className="btn btn-sm btn-ghost" onClick={() => openEdit(r)}>✏️</button>
                <button className="btn btn-sm btn-ghost" onClick={() => del(r._id)}>🗑</button>
              </div>
            </div>
          ))}
          {visible.length === 0 && <div className="empty"><div className="empty-ico">🔗</div><p>No references found</p></div>}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Reference' : 'Add Reference'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="form-group"><label>Title *</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Link title" /></div>
        <div className="form-group"><label>URL *</label><input value={form.url} onChange={e => setForm(f=>({...f,url:e.target.value}))} placeholder="https://..." /></div>
        <div className="form-group"><label>Tags (comma separated)</label><input value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))} placeholder="design, inspiration, tools" /></div>
        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Why is this useful?" /></div>
      </Modal>
    </>
  );
}
