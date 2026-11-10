import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useIdentity } from '../../context/IdentityContext';
import { Icon } from '../common/Icons';

/**
 * Dismissible safety strip under the header. Respects the caller's
 * `preferences.showCrisisBar`; it is informational only and never blocks the
 * page or traps attention.
 */
export default function CrisisBar() {
  const { identity } = useIdentity();
  const [dismissed, setDismissed] = useState(false);

  if (!identity || dismissed) return null;
  if (identity.preferences?.showCrisisBar === false) return null;

  return (
    <div className="border-b border-crisis-200 bg-crisis-50">
      <div className="container-page flex items-start gap-3 py-2.5">
        <Icon name="heart" className="mt-0.5 h-4 w-4 text-crisis-600" />
        <p className="min-w-0 flex-1 text-sm leading-snug text-crisis-700">
          If you are in immediate danger, contact your local emergency services.{' '}
          <Link to="/crisis" className="font-semibold underline underline-offset-2 hover:text-crisis-800">
            Crisis support with verified lines
          </Link>{' '}
          is always one click away. AdiYogi is peer support, not emergency care.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-crisis-600 hover:bg-crisis-100"
          aria-label="Dismiss safety notice"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
