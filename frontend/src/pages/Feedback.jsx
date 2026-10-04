import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { feedbackApi, fetcher, apiRoot } from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';

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
  const [name, setName] = useState('');
  const [open, setOpen] = useState(null); // source _id whose connection details are shown

  async function run(fn, ok) {
    try { const r = await fn(); toast(ok, 'success'); mutate(); return r; }
    catch (e) { toast(e.response?.data?.error || 'Something went wrong', 'error'); }
  }

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await run(() => feedbackApi.createSource({ name }), 'Website added — paste its URL and secret into the site');
    if (r) { setName(''); setOpen(r.data._id); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Feedback</h1>
          <p>Reviews sent in by each website · positive, neutral and negative at a glance</p>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isAdmin && (
          <form className="card" onSubmit={add} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200, margin: 0 }}>
              <label>Connect a website</label>
              <input value={name} maxLength={80} placeholder="e.g. LipiSub" onChange={e => setName(e.target.value)} />
            </div>
            <button className="btn btn-primary">Add website</button>
          </form>
        )}

        {sources && sources.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', padding: 48 }}>
            No websites connected yet{isAdmin ? ' — add one above' : ''}
          </div>
        )}

        {sources?.map(s => (
          <div key={s._id} className="card">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <Link to={`/feedback/${s.slug}`} style={{ fontSize: 18, fontWeight: 650, color: 'var(--text)' }}>{s.name}</Link>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {s.total} review{s.total === 1 ? '' : 's'} · {s.lastReceivedAt ? `last ${new Date(s.lastReceivedAt).toLocaleString()}` : 'nothing received yet'}
                </div>
              </div>
              {s.total > 0 && <SentimentBar counts={s.counts} total={s.total} width={220} />}
              <Link className="btn btn-sm btn-secondary" to={`/feedback/${s.slug}`}>Dashboard ›</Link>
              {isAdmin && (
                <button className="btn btn-sm btn-secondary" onClick={() => setOpen(open === s._id ? null : s._id)}>
                  {open === s._id ? 'Hide setup' : 'Setup'}
                </button>
              )}
            </div>

            {isAdmin && open === s._id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 13 }}>
                <p style={{ color: 'var(--text2)', marginBottom: 10 }}>
                  Set these on {s.name}'s server, then restart it. Every new review arrives here signed with the secret.
                </p>
                <Copyable label="CRM_WEBHOOK_URL" value={`${apiRoot()}/feedback/hook/${s.slug}`} />
                <Copyable label="CRM_WEBHOOK_SECRET" value={s.secret} />
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => confirm(`New secret for ${s.name}? It stops sending until you update its CRM_WEBHOOK_SECRET.`)
                    && run(() => feedbackApi.rotateSecret(s._id), 'New secret made')}>New secret</button>
                  <button className="btn btn-sm btn-danger" onClick={() => confirm(`Remove ${s.name} and all ${s.total} of its reviews?`)
                    && run(() => feedbackApi.deleteSource(s._id), 'Website removed')}>Remove</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function Copyable({ label, value }) {
  const toast = useToast();
  return (
    <div className="form-group" style={{ marginBottom: 8 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input readOnly value={value} onFocus={e => e.target.select()} style={{ fontFamily: 'monospace', fontSize: 12 }} />
        <button type="button" className="btn btn-sm btn-secondary"
          onClick={() => navigator.clipboard.writeText(value).then(() => toast('Copied', 'success'))}>Copy</button>
      </div>
    </div>
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
  const { data: st, error } = useSWR(`/feedback/sources/${slug}/stats`, fetcher);
  const { data: list } = useSWR(
    `/feedback/sources/${slug}/items?page=${page}&sentiment=${sentiment}&category=${category}`, fetcher, { keepPreviousData: true });

  if (error) return <div className="page-body"><div className="card">That website isn't connected. <Link to="/feedback">Back to Feedback</Link></div></div>;
  if (!st) return null;
  const filter = (fn) => (v) => { fn(v); setPage(0); };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{st.source.name} feedback</h1>
          <p><Link to="/feedback">All websites</Link> · {st.total} review{st.total === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        <div className="card">
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
          {list?.items.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>No reviews match</div>}
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
              {f.message && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{f.message}</div>}
            </div>
          ))}
          {list?.pages > 1 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text2)', alignSelf: 'center' }}>{page + 1} / {list.pages}</span>
              <button className="btn btn-sm btn-secondary" disabled={page >= list.pages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          )}
        </div>
      </div>
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
