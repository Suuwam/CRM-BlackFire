import { useEffect, useState } from 'react';

// Client-side paging for lists the page already holds. Snaps back to the last page when
// the list shrinks (a delete or a filter), and to page 1 when `resetKey` changes.
export function usePage(items, size, resetKey) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [resetKey]);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return { items: items.slice(current * size, current * size + size), page: current, pages, setPage, total: items.length };
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
