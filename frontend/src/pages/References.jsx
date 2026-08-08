import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { referencesApi, fetcher } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const EMPTY = { title:'', url:'', description:'', image:'', tags:'', notes:'', category:'General' };

// --- Draft cache helpers for References ---
const REF_DRAFT_PREFIX = 'crm_ref_draft_';
function getRefDraftKey(id) { return REF_DRAFT_PREFIX + (id || 'new'); }
function saveRefDraft(id, formData) {
  try { sessionStorage.setItem(getRefDraftKey(id), JSON.stringify({ form: formData, ts: Date.now() })); } catch {}
}
function loadRefDraft(id) {
  try {
    const raw = sessionStorage.getItem(getRefDraftKey(id));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - d.ts > 86400000) { sessionStorage.removeItem(getRefDraftKey(id)); return null; }
    return d;
  } catch { return null; }
}
function clearRefDraft(id) { try { sessionStorage.removeItem(getRefDraftKey(id)); } catch {} }

export default function References() {
  const [search, setSearch]         = useState('');
  const [tagFilter, setTagFilter]   = useState('');
  const [modal, setModal]           = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [editing, setEditing]       = useState(null);
  const [scraping, setScraping]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const toast = useToast();

  const { data: refs = [] } = useSWR('/references', fetcher, { revalidateOnFocus: false });

  // Auto-save form to sessionStorage while modal is open
  useEffect(() => {
    if (modal) saveRefDraft(editing, form);
  }, [modal, form, editing]);

  function openAdd() {
    const draft = loadRefDraft(null);
    if (draft && (draft.form.url.trim() || draft.form.title.trim())) {
      setForm(draft.form); setEditing(null); setModal(true);
      toast('Restored unsaved draft', 'info');
    } else {
      setForm(EMPTY); setEditing(null); setModal(true);
    }
  }
  function openEdit(r) {
    const draft = loadRefDraft(r._id);
    if (draft && (draft.form.url.trim() || draft.form.title.trim())) {
      setForm(draft.form); setEditing(r._id); setModal(true);
      toast('Restored unsaved edits', 'info');
    } else {
      setForm({
        title: r.title,
        url: r.url,
        description: r.description || '',
        image: r.image || '',
        tags: (r.tags||[]).join(', '),
        notes: r.notes || '',
        category: r.category || 'General'
      });
      setEditing(r._id);
      setModal(true);
    }
  }

  async function handleScrape() {
    if (!form.url.trim()) return toast('Enter a URL first', 'error');
    setScraping(true);
    try {
      const res = await referencesApi.scrape(form.url.trim());
      if (res.data) {
        setForm(f => ({
          ...f,
          title: res.data.title || f.title || hostname(res.data.url),
          description: res.data.description || f.description,
          image: res.data.image || f.image,
          url: res.data.url || f.url
        }));
        toast('Link details scraped!', 'success');
      }
    } catch (e) {
      toast('Failed to scrape metadata', 'error');
    } finally {
      setScraping(false);
    }
  }

  async function save() {
    if (saving) return;
    if (!form.url.trim()) return toast('URL is required', 'error');
    const finalTitle = form.title.trim() || hostname(form.url);
    const data = {
      ...form,
      title: finalTitle,
      tags: form.tags.split(',').map(t=>t.trim()).filter(Boolean)
    };
    setSaving(true);
    try {
      if (editing) {
        mutate('/references', refs.map(r => r._id === editing ? { ...r, ...data } : r), false);
        await referencesApi.update(editing, data);
      } else {
        const res = await referencesApi.create(data);
        mutate('/references', [...refs, res.data], false);
      }
      clearRefDraft(editing);
      toast('Reference saved', 'success'); setModal(false);
      mutate('/references');
    } catch { toast('Error saving reference', 'error'); mutate('/references'); }
    finally { setSaving(false); }
  }

  async function del(id) {
    mutate('/references', refs.filter(r => r._id !== id), false);
    toast('Reference deleted', 'info');
    await referencesApi.delete(id);
    mutate('/references');
  }

  const allTags = [...new Set(refs.flatMap(r => r.tags || []))].sort();

  const visible = refs.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || r.title.toLowerCase().includes(q) || r.url.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q));
    const matchT = !tagFilter || (r.tags || []).includes(tagFilter);
    return matchQ && matchT;
  });

  function hostname(url) {
    try {
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      return u.hostname;
    } catch { return url; }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>References & Knowledge Vault</h1><p>Curated links with automatic preview cards & web metadata scraper</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Link</button>
      </div>
      <div className="page-body">
        <div className="toolbar">
          <div className="search">
            <span className="search-ico">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input placeholder="Search links & descriptions..." value={search} onChange={e => setSearch(e.target.value)} />
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
              {r.image && (
                <div className="ref-img-wrap">
                  <img src={r.image} alt={r.title} className="ref-img" onError={e => e.target.style.display='none'} />
                </div>
              )}
              <div className="ref-content">
                <div className="ref-title">{r.title}</div>
                <div className="ref-url-badge">{hostname(r.url)}</div>
                {r.description && <div className="ref-desc">{r.description}</div>}
                {r.notes && <div className="ref-notes">Notes: {r.notes}</div>}
                {r.tags && r.tags.length > 0 && (
                  <div className="ref-tags" style={{ marginTop: 8 }}>
                    {r.tags.map(t => <span key={t} className="ref-tag" onClick={() => setTagFilter(t)}>{t}</span>)}
                  </div>
                )}
              </div>
              <div className="ref-foot">
                <a href={r.url.startsWith('http') ? r.url : 'https://' + r.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">↗ Open Link</a>
                <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText(r.url); toast('Copied URL!', 'success'); }} title="Copy link">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)} title="Edit link">Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => del(r._id)} title="Delete link">Delete</button>
              </div>
            </div>
          ))}
          {visible.length === 0 && <div className="empty"><div className="empty-ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div><p>No reference links saved yet.</p></div>}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Reference' : 'Add Reference'}
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
        <div className="form-group">
          <label>URL *</label>
          <div style={{ display:'flex', gap:8 }}>
            <input value={form.url} onChange={e => setForm(f=>({...f,url:e.target.value}))} placeholder="https://example.com/article" style={{ flex:1 }} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleScrape} disabled={scraping}>
              {scraping ? 'Scraping...' : 'Auto-Scrape'}
            </button>
          </div>
        </div>

        <div className="form-group"><label>Title</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Auto-scraped or custom title" /></div>
        <div className="form-group"><label>Cover Picture URL</label><input value={form.image} onChange={e => setForm(f=>({...f,image:e.target.value}))} placeholder="https://..." /></div>
        <div className="form-group"><label>Short Summary / Description</label><textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Short overview..." rows={2} /></div>
        <div className="form-group"><label>Tags (comma separated)</label><input value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))} placeholder="design, audio, ai, docs" /></div>
        <div className="form-group"><label>Personal Notes</label><textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="Why is this reference important?" rows={2} /></div>
      </Modal>
    </>
  );
}
