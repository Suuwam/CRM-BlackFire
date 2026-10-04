import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { feedbackApi, fetcher, apiRoot } from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import Pager, { usePage, useFitCount } from '../components/Pager';
import Modal from '../components/Modal';
import ColorPicker from '../components/ColorPicker';

const SENTIMENTS = [
  { key: 'positive', label: 'Positive', sub: '4–5★', color: 'var(--fb-pos)' },
  { key: 'neutral',  label: 'Neutral',  sub: '3★',   color: 'var(--fb-neu)' },
  { key: 'negative', label: 'Negative', sub: '1–2★', color: 'var(--fb-neg)' },
];
const CATEGORIES = ['bug', 'idea', 'praise', 'other'];
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

export default function Feedback() {
  const { slug } = useParams();
  return slug ? <SourceDashboard slug={slug} /> : <Sources />;
}

// ─── All websites + (admin) connecting a new one ─────────────────────────────
function Sources() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const toast = useToast();
  const { data: sources, mutate } = useSWR('/feedback/sources', fetcher);
  const [adding, setAdding] = useState(null);   // { name, color } while the add window is open
  const [setupId, setSetupId] = useState(null); // website whose setup window is open
  const [srcRef, srcFit] = useFitCount(9, sources?.length);
  const srcPg = usePage(sources || [], srcFit);
  const setup = sources?.find(s => s._id === setupId);

  async function run(fn, ok) {
    try { const r = await fn(); if (ok) toast(ok, 'success'); mutate(); return r; }
    catch (e) { toast(e.response?.data?.error || 'Something went wrong', 'error'); }
  }

  async function add(e) {
    e.preventDefault();
    if (!adding?.name.trim()) return;
    const r = await run(() => feedbackApi.createSource(adding), 'Website added. Follow the steps to connect it.');
    if (r) { setAdding(null); setSetupId(r.data._id); }
  }

  const all = sources || [];
  const reviews = all.reduce((n, s) => n + s.total, 0);
  const positive = all.reduce((n, s) => n + s.counts.positive, 0);
  const avg = reviews ? Math.round((all.reduce((n, s) => n + s.avgRating * s.total, 0) / reviews) * 10) / 10 : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Feedback</h1>
          <p>Reviews from every website, each with its own dashboard</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={() => setAdding({ name: '', color: '#3b82f6' })}>+ Add website</button>}
      </div>

      <div className="page-body page-fit" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {all.length > 0 && (
          <div className="stats-grid fb-summary">
            <div className="stat-card"><div className="stat-label">Websites</div><div className="stat-value">{all.length}</div><div className="stat-sub">{all.filter(s => s.lastReceivedAt).length} connected</div></div>
            <div className="stat-card"><div className="stat-label">Reviews</div><div className="stat-value">{reviews.toLocaleString()}</div><div className="stat-sub">across all websites</div></div>
            <div className="stat-card"><div className="stat-label">Average rating</div><div className="stat-value">{avg || '–'}</div><div className="stat-sub">{reviews ? stars(Math.round(avg)) : 'no reviews yet'}</div></div>
            <div className="stat-card"><div className="stat-label">Positive</div><div className="stat-value" style={{ color: 'var(--fb-pos)' }}>{pct(positive, reviews)}%</div><div className="stat-sub">4–5★ reviews</div></div>
          </div>
        )}

        {sources && all.length === 0 && (
          <div className="card fb-empty">
            <div className="fb-empty-title">No websites yet</div>
            <p>{isAdmin ? 'Add your first website, then paste the two lines it gives you into that site’s server.' : 'An admin can add one.'}</p>
            {isAdmin && <button className="btn btn-primary" onClick={() => setAdding({ name: '', color: '#3b82f6' })}>+ Add website</button>}
          </div>
        )}

        <div className="fb-grid fit-area" ref={srcRef}>
          {srcPg.items.map(s => (
            <div key={s._id} className="card fb-site" style={{ '--site': s.color || '#3b82f6' }}>
              <div className="fb-site-head">
                <span className="fb-site-badge">{s.name.slice(0, 1).toUpperCase()}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link to={`/feedback/${s.slug}`} className="fb-site-name">{s.name}</Link>
                  <div className={`fb-site-status${s.lastReceivedAt ? ' is-on' : ''}`}>
                    {s.lastReceivedAt ? `Connected · last review ${timeAgo(s.lastReceivedAt)}` : 'Waiting for the first review'}
                  </div>
                </div>
              </div>

              <div className="fb-site-stats">
                <div><strong>{s.total ? s.avgRating : '–'}</strong><span>{s.total ? stars(Math.round(s.avgRating)) : 'rating'}</span></div>
                <div><strong>{s.total.toLocaleString()}</strong><span>review{s.total === 1 ? '' : 's'}</span></div>
                <div><strong style={{ color: 'var(--fb-pos)' }}>{pct(s.counts.positive, s.total)}%</strong><span>positive</span></div>
              </div>
              {s.total > 0 ? <SentimentBar counts={s.counts} total={s.total} /> : <div className="fb-site-bar-empty" />}

              <div className="fb-site-actions">
                <Link className="btn btn-sm btn-primary fb-site-open" to={`/feedback/${s.slug}`}>Open dashboard</Link>
                {isAdmin && <button className="btn btn-sm btn-secondary" onClick={() => setSetupId(s._id)}>{s.lastReceivedAt ? 'Settings' : 'How to connect'}</button>}
              </div>
            </div>
          ))}
        </div>
        <Pager {...srcPg} />
      </div>

      <Modal open={!!adding} onClose={() => setAdding(null)} title="Add website"
        footer={<><button className="btn btn-secondary" onClick={() => setAdding(null)}>Cancel</button><button className="btn btn-primary" onClick={add}>Add website</button></>}>
        {adding && (
          <form onSubmit={add}>
            <div className="form-group"><label>Website name</label>
              <input autoFocus value={adding.name} maxLength={80} placeholder="e.g. LipiSub" onChange={e => setAdding(a => ({ ...a, name: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginTop: 14 }}><label>Colour</label>
              <ColorPicker hex value={adding.color} onChange={color => setAdding(a => ({ ...a, color }))} />
            </div>
          </form>
        )}
      </Modal>

      <Modal large open={!!setup} onClose={() => setSetupId(null)} title={setup ? `${setup.name} settings` : ''}
        footer={setup && (
          <>
            <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => confirm(`Remove ${setup.name} and all ${setup.total} of its reviews?`)
              && run(() => feedbackApi.deleteSource(setup._id), 'Website removed').then(r => r && setSetupId(null))}>Remove website</button>
            <button className="btn btn-secondary" onClick={() => confirm(`New secret for ${setup.name}? It stops sending until you update its CRM_WEBHOOK_SECRET.`)
              && run(() => feedbackApi.rotateSecret(setup._id), 'New secret made')}>New secret</button>
            <button className="btn btn-primary" onClick={() => setSetupId(null)}>Done</button>
          </>
        )}>
        {setup && (
          <>
            <div className="form-group" style={{ marginBottom: 18 }}><label>Colour</label>
              <ColorPicker hex value={setup.color} onChange={color => run(() => feedbackApi.updateSource(setup._id, { color }))} />
            </div>
            <ConnectSteps source={setup} />
          </>
        )}
      </Modal>
    </>
  );
}

function timeAgo(d) {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

// Step-by-step for the site's server. LipiSub reads exactly these two variables
// (lipsub-backend/src/config/env.js); another site copies LipiSub's crmWebhook.js.
function ConnectSteps({ source }) {
  const toast = useToast();
  const env = `CRM_WEBHOOK_URL=${apiRoot()}/feedback/hook/${source.slug}\nCRM_WEBHOOK_SECRET=${source.secret}`;
  const step = { margin: '0 0 10px', paddingLeft: 18, color: 'var(--text2)', lineHeight: 1.6 };
  return (
    <>
      <div style={{ fontWeight: 650, marginBottom: 8 }}>Connect {source.name} in 4 steps</div>
      <ol style={step}>
        <li>On {source.name}'s <b>backend server</b>, open its <code>.env</code> file.
          For LipiSub: cPanel → <b>File Manager</b> → <code>api.lipisub.com/.env</code>.</li>
        <li>Paste these two lines at the bottom (replace them if they're already there), then save:
          <div style={{ position: 'relative', margin: '6px 0' }}>
            <pre style={{ margin: 0, padding: '10px 12px', paddingRight: 70, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{env}</pre>
            <button type="button" className="btn btn-sm btn-secondary" style={{ position: 'absolute', top: 6, right: 6 }}
              onClick={() => navigator.clipboard.writeText(env).then(() => toast('Copied both lines', 'success'))}>Copy</button>
          </div>
        </li>
        <li><b>Restart</b> the backend. For LipiSub: cPanel → <b>Setup Node.js App</b> → <b>Restart</b>.</li>
        <li>Check it: in {source.name}'s <b>Admin → Feedback</b> the note should now read
          “New reviews are sent to the CRM automatically”. Press <b>Send to CRM</b> on older reviews to bring them in.
          This card turns <span style={{ color: '#16a34a' }}>● Connected</span> when the first review arrives.</li>
      </ol>
      <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
        Keep the secret private. If it leaks, press <b>New secret</b> and repeat steps 2–3.
        A website other than LipiSub needs LipiSub's <code>crmWebhook.js</code> copied in first (see the CRM README).
      </p>
    </>
  );
}

// 100% bar split by sentiment; labelled so it never relies on colour alone.
function SentimentBar({ counts, total, width = '100%', labels = false }) {
  return (
    <div style={{ width }}>
      <div style={{ display: 'flex', gap: 2, height: 10 }} role="img"
        aria-label={SENTIMENTS.map(s => `${s.label} ${counts[s.key]}`).join(', ')}>
        {SENTIMENTS.filter(s => counts[s.key]).map(s => (
          <div key={s.key} title={`${s.label}: ${counts[s.key]} (${pct(counts[s.key], total)}%)`}
            style={{ flex: counts[s.key], background: s.color, borderRadius: 4 }} />
        ))}
      </div>
      {labels && (
        <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap' }}>
          {SENTIMENTS.map(s => (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              {s.label} {pct(counts[s.key], total)}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── One website's dashboard ─────────────────────────────────────────────────
function SourceDashboard({ slug }) {
  const [sentiment, setSentiment] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [reviewRef, perPage] = useFitCount(20, `${sentiment}|${category}|${page}`);
  const { data: st, error } = useSWR(`/feedback/sources/${slug}/stats`, fetcher);
  const { data: list } = useSWR(
    `/feedback/sources/${slug}/items?page=${page}&limit=${perPage}&sentiment=${sentiment}&category=${category}`, fetcher, { keepPreviousData: true });

  if (error) return <div className="page-body"><div className="card">That website isn't connected. <Link to="/feedback">Back to Feedback</Link></div></div>;
  if (!st) return null;
  const filter = (fn) => (v) => { fn(v); setPage(0); };

  return (
    <>
      <div className="page-head">
        <div>
          <h1><span className="fb-head-badge" style={{ background: st.source.color }}>{st.source.name.slice(0, 1).toUpperCase()}</span>{st.source.name} feedback</h1>
          <p><Link to="/feedback">All websites</Link> · {st.total} review{st.total === 1 ? '' : 's'}</p>
        </div>
      </div>

      {st.total === 0 ? (
        <div className="page-body">
          <div className="card fb-hero" style={{ '--site': st.source.color }}>
            <span className="fb-hero-badge">{st.source.name.slice(0, 1).toUpperCase()}</span>
            <div className="fb-hero-title">Waiting for {st.source.name}'s first review</div>
            <p>As soon as someone leaves feedback on {st.source.name}, it shows up here with ratings, trends and similar-review groups.
              If nothing arrives, check that the website is connected.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" to="/feedback">How to connect</Link>
            </div>
          </div>
        </div>
      ) : (
      <div className="page-body page-fit fb-dash" style={{ '--site': st.source.color }}>
        <div className="fb-insights">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Average rating</div>
            <div className="stat-value">{st.avgRating || '–'}</div>
            <div className="stat-sub">{st.total ? stars(Math.round(st.avgRating)) : 'no reviews yet'}</div>
          </div>
          {SENTIMENTS.map(s => (
            <div key={s.key} className="stat-card" style={{ cursor: 'pointer', boxShadow: sentiment === s.key ? `0 0 0 2px ${s.color}` : undefined }}
              onClick={() => filter(setSentiment)(sentiment === s.key ? '' : s.key)}>
              <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />{s.label} · {s.sub}
              </div>
              <div className="stat-value">{st.sentiment[s.key]}</div>
              <div className="stat-sub">{pct(st.sentiment[s.key], st.total)}% of reviews</div>
            </div>
          ))}
        </div>

        {st.total > 0 && (
          <div className="card">
            <div className="section-title" style={{ marginBottom: 10 }}>Sentiment split</div>
            <SentimentBar counts={st.sentiment} total={st.total} labels />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <DailyChart days={st.days} />
          <div className="card">
            <div className="section-title" style={{ marginBottom: 10 }}>Ratings</div>
            {[5, 4, 3, 2, 1].map(r => {
              const n = st.ratings[r] || 0;
              const color = r >= 4 ? 'var(--fb-pos)' : r === 3 ? 'var(--fb-neu)' : 'var(--fb-neg)';
              return (
                <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 6 }}>
                  <span style={{ width: 36, color: 'var(--text2)' }}>{r}★</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4 }}>
                    <div style={{ width: `${pct(n, st.total)}%`, height: '100%', background: color, borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 30, textAlign: 'right', color: 'var(--text2)' }}>{n}</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {CATEGORIES.map(c => (
                <span key={c} className="tag tag-gray">{c} · {st.categories[c] || 0}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Similar feedback</div>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: '2px 0 12px' }}>Reviews that say much the same thing, from the latest 500</p>
          {st.similar.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No repeated themes yet</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {st.similar.map((g, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 22, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{g.count}×</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    {g.keywords.map(k => <span key={k} className="tag tag-blue">{k}</span>)}
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>avg {g.avgRating}★</span>
                  </div>
                  {g.examples.map(ex => (
                    <div key={ex._id} style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>“{ex.message}” <span style={{ color: 'var(--text3)' }}>{ex.rating}★</span></div>
                  ))}
                </div>
                <SentimentBar counts={g.sentiment} total={g.count} width={90} />
              </div>
            ))}
          </div>
        </div>

        </div>

        <div className="card fb-reviews">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div className="section-title" style={{ marginRight: 'auto' }}>All reviews · {list?.total ?? 0}</div>
            <select value={sentiment} onChange={e => filter(setSentiment)(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Any sentiment</option>
              {SENTIMENTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={category} onChange={e => filter(setCategory)(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Any category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {list?.items.length === 0 && <div className="fb-none">No reviews match these filters.</div>}
          <div className="fit-area" ref={reviewRef}>
          {list?.items.map(f => (
            <div key={f._id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: SENTIMENTS.find(s => s.key === f.sentiment).color, letterSpacing: 1 }}>{stars(f.rating)}</span>
                <span className="tag tag-gray">{f.category}</span>
                {f.urgent && <span className="tag tag-red">urgent</span>}
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text3)' }}>
                  {[f.user?.name || f.user?.email, f.user?.plan, f.page, new Date(f.sentAt).toLocaleString()].filter(Boolean).join(' · ')}
                </span>
              </div>
              {f.message && <div className="fb-review-msg" title={f.message}>{f.message}</div>}
            </div>
          ))}
          </div>
          {list?.pages > 1 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text2)', alignSelf: 'center' }}>{page + 1} / {list.pages}</span>
              <button className="btn btn-sm btn-secondary" disabled={page >= list.pages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          )}
        </div>
      </div>
      )}
    </>
  );
}

// Last 30 days, one stacked bar per day (negative at the base so problems read first).
function DailyChart({ days }) {
  const [hover, setHover] = useState(null);
  const keys = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10));
  const totals = keys.map(k => { const d = days[k]; return d ? d.positive + d.neutral + d.negative : 0; });
  const max = Math.max(1, ...totals);
  const order = [...SENTIMENTS].reverse();
  const h = hover != null ? days[keys[hover]] : null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div className="section-title">Last 30 days</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', minHeight: 16 }}>
          {hover != null
            ? `${new Date(keys[hover]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${totals[hover]} — ${h ? SENTIMENTS.map(s => `${h[s.key]} ${s.label.toLowerCase()}`).join(', ') : 'none'}`
            : `peak ${max} a day`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, borderBottom: '1px solid var(--border)' }}
        onMouseLeave={() => setHover(null)}>
        {keys.map((k, i) => (
          <div key={k} onMouseEnter={() => setHover(i)}
            style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column-reverse', gap: totals[i] ? 2 : 0, cursor: 'default',
              background: hover === i ? 'var(--surface2)' : 'transparent' }}>
            {order.map(s => days[k]?.[s.key] ? (
              <div key={s.key} style={{ height: `${(days[k][s.key] / max) * 100}%`, background: s.color, borderRadius: 2, minHeight: 2 }} />
            ) : null)}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
        <span>{new Date(keys[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span>Today</span>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>
        {SENTIMENTS.map(s => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
