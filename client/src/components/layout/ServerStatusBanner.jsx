import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIdentity } from '../../context/IdentityContext';
import { Icon } from '../common/Icons';

/**
 * Connection status banner.
 *
 * When the API cannot be reached (misconfigured deployment, API down, network loss) the
 * anonymous session cannot be created. Previously the only signal was a small, unexplained
 * "Reconnect" button in the top-right corner, which looked like a feature rather than a
 * failure. This banner explains the state in plain language, offers an explicit retry, and
 * keeps the crisis affordance visible.
 *
 * It renders nothing while the session is healthy or still loading.
 */
export default function ServerStatusBanner() {
  const { error, loading, refresh, identity } = useIdentity();
  const [retrying, setRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // A previously failed bootstrap that later succeeds should clear the banner, and an
  // offline → online transition should retry once automatically.
  useEffect(() => {
    if (!error) setDismissed(false);
  }, [error]);

  useEffect(() => {
    if (!error) return undefined;
    const onOnline = () => {
      setRetrying(true);
      refresh().finally(() => setRetrying(false));
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [error, refresh]);

  if (loading || !error || dismissed || identity) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div role="status" className="border-b border-accent-300 bg-accent-50">
      <div className="container-page flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5 text-sm leading-snug text-accent-800">
          <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">The AdiYogi server can’t be reached right now.</span> You can
            still read this page and the crisis resources. Posting, the AI companion and accounts need the
            server.
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/crisis" className="text-sm font-semibold text-crisis-700 underline underline-offset-2">
            Get help now
          </Link>
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="btn-secondary btn-sm min-h-[40px]"
          >
            {retrying ? 'Retrying…' : 'Retry connection'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-accent-700 hover:bg-accent-100"
            aria-label="Dismiss connection notice"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
