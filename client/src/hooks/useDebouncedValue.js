import { useEffect, useRef, useState } from 'react';

/**
 * Returns `value` only after it has stopped changing for `delay` ms.
 * Used for search inputs and draft crisis assessment so the API is not hit on
 * every keystroke.
 */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return undefined;
    }
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
