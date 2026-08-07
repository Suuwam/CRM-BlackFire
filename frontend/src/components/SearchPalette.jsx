import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api';

function highlightMatch(text, query) {
  if (!query || !text) return text || '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(249,115,22,0.25)', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const ICONS = {
  client:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  task:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  event:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  reference: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
};

const TYPE_LABELS = { client: 'Client', task: 'Task', event: 'Event', reference: 'Reference' };
const TYPE_COLORS = { client: '#10b981', task: '#f97316', event: '#3b82f6', reference: '#8b5cf6' };

export default function SearchPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const { data: clients = [] }    = useSWR('/clients', fetcher, { revalidateOnFocus: false });
  const { data: tasks = [] }      = useSWR('/tasks', fetcher, { revalidateOnFocus: false });
  const { data: references = [] } = useSWR('/references', fetcher, { revalidateOnFocus: false });

  // Build unified result set
  const results = (() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const hits = [];

    clients.forEach(c => {
      if ((c.name || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)) {
        hits.push({ type: 'client', id: c._id, title: c.name, sub: c.company || c.email, nav: '/clients' });
      }
    });

    tasks.forEach(t => {
      if ((t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || (t.assigneeName || '').toLowerCase().includes(q)) {
        hits.push({ type: 'task', id: t._id, title: t.title, sub: `${t.project} · ${t.column}`, nav: `/board?project=${t.project}` });
      }
    });

    references.forEach(r => {
      if ((r.title || '').toLowerCase().includes(q) || (r.url || '').toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q)) {
        hits.push({ type: 'reference', id: r._id, title: r.title || r.url, sub: r.url, nav: '/references' });
      }
    });

    return hits.slice(0, 12);
  })();

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const handleSelect = useCallback((item) => {
    if (!item) return;
    navigate(item.nav);
    onClose();
  }, [navigate, onClose]);

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(results[activeIdx]);
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      className="search-palette-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-palette" role="dialog" aria-modal="true" aria-label="Global search">
        {/* Search Input */}
        <div className="search-palette-input-row">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text3)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            className="search-palette-input"
            placeholder="Search clients, tasks, events, references..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="search-palette-esc" onClick={onClose}>esc</kbd>
        </div>

        {/* Results */}
        <div className="search-palette-body">
          {query.trim() === '' && (
            <div className="search-palette-hint">
              <div className="search-palette-hint-row">
                <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>Start typing to search across all data...</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
                {[['Clients', '#10b981'], ['Tasks', '#f97316'], ['Events', '#3b82f6'], ['References', '#8b5cf6']].map(([label, color]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {query.trim() !== '' && results.length === 0 && (
            <div className="search-palette-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--border2)', margin: '0 auto 10px' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <div>No results for <strong>"{query}"</strong></div>
            </div>
          )}

          {results.length > 0 && (
            <ul className="search-palette-list" ref={listRef} role="listbox">
              {results.map((item, i) => (
                <li
                  key={`${item.type}-${item.id}`}
                  className={`search-palette-item${activeIdx === i ? ' search-palette-item--active' : ''}`}
                  role="option"
                  aria-selected={activeIdx === i}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => handleSelect(item)}
                >
                  <span className="search-palette-item-icon" style={{ color: TYPE_COLORS[item.type] }}>
                    {ICONS[item.type]}
                  </span>
                  <span className="search-palette-item-type" style={{ background: `${TYPE_COLORS[item.type]}1a`, color: TYPE_COLORS[item.type] }}>
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className="search-palette-item-title">
                    {highlightMatch(item.title, query)}
                  </span>
                  {item.sub && (
                    <span className="search-palette-item-sub">
                      {highlightMatch(item.sub, query)}
                    </span>
                  )}
                  <span className="search-palette-item-arrow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="search-palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto' }}>{results.length > 0 ? `${results.length} result${results.length !== 1 ? 's' : ''}` : ''}</span>
        </div>
      </div>
    </div>
  );
}
