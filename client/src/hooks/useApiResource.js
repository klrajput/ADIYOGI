import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Standard data-fetching hook: gives every screen consistent loading/error/
 * success handling, stale-response protection and a manual refetch.
 *
 * @param {(signal:AbortSignal) => Promise<*>} fetcher
 * @param {Array} deps
 * @param {{enabled?:boolean, initialData?:*}} [options]
 */
export function useApiResource(fetcher, deps = [], options = {}) {
  const { enabled = true, initialData = null } = options;
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(
    async (signal) => {
      const currentRequest = requestId.current + 1;
      requestId.current = currentRequest;
      setLoading(true);
      setError(null);
      try {
        const result = await fetcherRef.current(signal);
        if (requestId.current !== currentRequest) return;
        // Support both `{data, meta}` envelopes and raw values.
        if (result && typeof result === 'object' && 'data' in result) {
          setData(result.data);
          setMeta(result.meta ?? null);
        } else {
          setData(result);
          setMeta(null);
        }
      } catch (caught) {
        if (requestId.current !== currentRequest) return;
        if (caught?.name === 'AbortError') return;
        setError(caught);
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [enabled, load]);

  const refetch = useCallback(() => load(), [load]);

  return { data, meta, error, loading, refetch, setData };
}

export default useApiResource;
