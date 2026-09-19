// Placeholder shapes that hold the same space the real content will. Rendering these
// instead of an empty state stops the layout jumping when data lands, and gives the eye
// something to read as progress rather than as "there is nothing here".

export function SkeletonBlock({ w = '100%', h = 14, r = 6, style }) {
  return <span className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function SkeletonText({ lines = 3, width = ['90%', '75%', '55%'] }) {
  return (
    <div className="sk-stack">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock key={i} w={width[i % width.length]} h={12} />
      ))}
    </div>
  );
}

// Matches the <Panel> shell on the dashboard: header row, then body.
export function SkeletonPanel({ bodyHeight = 150 }) {
  return (
    <section className="panel" aria-hidden="true">
      <header className="panel-head">
        <SkeletonBlock w={110} h={13} />
        <SkeletonBlock w={70} h={10} />
      </header>
      <div className="panel-body">
        <SkeletonBlock w="100%" h={bodyHeight} r={8} />
      </div>
    </section>
  );
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="sk-stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row">
          <SkeletonBlock w={26} h={26} r="50%" />
          <SkeletonBlock w={`${45 + (i % 3) * 15}%`} h={12} />
          <SkeletonBlock w={32} h={12} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  );
}

// Whole-route fallback while a lazily loaded page chunk is in flight.
export default function PageSkeleton() {
  return (
    <div className="page-body" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="sk-stack" style={{ gap: 14 }}>
        <SkeletonBlock w={200} h={24} r={8} />
        <SkeletonBlock w={320} h={12} />
        <div className="sk-grid">
          {Array.from({ length: 4 }, (_, i) => <SkeletonBlock key={i} w="100%" h={84} r={12} />)}
        </div>
        <SkeletonBlock w="100%" h={220} r={12} />
      </div>
    </div>
  );
}
