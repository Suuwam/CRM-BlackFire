import { useEffect, useLayoutEffect, useState } from 'react';

// Client-side paging for lists the page already holds. Snaps back to the last page when
// the list shrinks (a delete or a filter), and to page 1 when `resetKey` changes.
export function usePage(items, size, resetKey) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [resetKey]);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return { items: items.slice(current * size, current * size + size), page: current, pages, setPage, total: items.length };
}

const DESKTOP = '(min-width: 769px)';

// How many items fit in the list box without scrolling. Put the ref on the element whose
// children are the items (a flex column, a grid, or a table's wrapper with `item: 'tbody tr'`).
// Measures the tallest item on screen and the grid's column count, and re-measures when the
// box resizes, its items change, or `watch` changes. Phones keep `fallback` and scroll normally.
export function useFitCount(fallback, watch, { item, gap: fixedGap } = {}) {
  // A callback ref, so a list that mounts late (after data loads) is still picked up.
  const [el, ref] = useState(null);
  const [count, setCount] = useState(fallback);
  useLayoutEffect(() => {
    if (!el) return;
    const mq = matchMedia(DESKTOP);
    const measure = () => {
      if (!mq.matches) return setCount(fallback);
      const items = item ? [...el.querySelectorAll(item)] : [...el.children];
      const h = Math.max(0, ...items.map(i => i.getBoundingClientRect().height));
      if (!h) return;
      const cs = getComputedStyle(el);
      const gap = fixedGap ?? (parseFloat(cs.rowGap) || 0);
      const cols = cs.display === 'grid' ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : 1;
      const head = item ? (el.querySelector('thead')?.getBoundingClientRect().height || 0) : 0;
      const rows = Math.max(1, Math.floor((el.clientHeight - head + gap) / (h + gap)));
      const next = rows * cols;
      setCount(c => (c === next ? c : next));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(measure); // items arriving or changing page
    mo.observe(el, { childList: true, subtree: !!item });
    mq.addEventListener('change', measure);
    measure();
    return () => { ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', measure); };
  }, [el, fallback, watch, item, fixedGap]);
  return [ref, count];
}

export default function Pager({ page, pages, setPage, style }) {
  if (pages <= 1) return null;
  return (
    <div className="pager" style={style}>
      <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
      <span className="pager-info">Page {page + 1} of {pages}</span>
      <button className="btn btn-sm btn-secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  );
}
