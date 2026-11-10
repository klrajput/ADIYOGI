import useOnlineStatus from '../../hooks/useOnlineStatus';

/**
 * Honest connectivity banner. AdiYogi has no offline cache, so it says so
 * rather than pretending content is fresh.
 */
export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" aria-live="polite" className="bg-ink px-4 py-2 text-center text-sm text-white">
      You are offline. Some content will not load until your connection returns — this page will stay here.
    </div>
  );
}
