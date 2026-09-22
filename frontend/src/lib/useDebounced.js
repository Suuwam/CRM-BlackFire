import { useEffect, useState } from 'react';

// Returns `value` only once it has stopped changing for `delay` ms. Typing "invoice" then
// goes through one filter pass instead of seven, and — where the value drives a request —
// one fetch instead of seven.
export function useDebounced(value, delay = 200) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return settled;
}

export default useDebounced;
