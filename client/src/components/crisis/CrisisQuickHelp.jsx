import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { crisis } from '../../api/endpoints';
import useApiResource from '../../hooks/useApiResource';
import { contactHref, contactLabel, FIND_A_HELPLINE, normaliseCrisisResources, safeHttpUrl } from './resources';
import { getSavedRegion, toApiCountry } from './regionStorage';

/**
 * Compact, always-available human-help block. Reused by the chat page (after the
 * API flags risk) and anywhere else that needs an immediate way out.
 *
 * Data comes from `GET /crisis/resources` for the region the visitor saved in the
 * crisis page. When that request fails it still renders the international
 * directory and a generic emergency pointer — clearly not location-specific.
 */
export default function CrisisQuickHelp({ initialResources = null, className = '', showAllLink = true }) {
  const savedCountry = getSavedRegion();

  const fetchResources = useCallback(() => {
    const country = toApiCountry(savedCountry);
    return crisis.resources(country ? { country } : undefined);
  }, [savedCountry]);

  // Always ask the API for the visitor's saved region; the inline copy (when the
  // chat response already included one) is only a seed shown during the request.
  const { data, error, loading } = useApiResource(fetchResources, [savedCountry], {
    initialData: initialResources,
  });

  const resources = normaliseCrisisResources(data);
  const primary = resources?.primary || null;
  const textLine = resources?.text || null;
  const emergency = resources?.emergency || null;
  const helplineUrl = safeHttpUrl((resources?.international || FIND_A_HELPLINE).url) || FIND_A_HELPLINE.url;

  const unavailable = Boolean(error) && !resources;

  return (
    <section
      role="region"
      aria-label="Crisis support"
      className={`rounded-lg border border-crisis-200 bg-crisis-50 p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-xl leading-6">
          🤝
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-base text-crisis-700">You deserve human support right now</h2>
          <p className="mt-1 text-sm leading-relaxed text-crisis-700/90">
            You do not have to explain yourself perfectly to reach a person. If you or someone else is
            in immediate danger, call your local emergency number.
          </p>
        </div>
      </div>

      {loading && !resources ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <span className="sr-only">Loading local helplines</span>
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-2/3" />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {primary && contactHref(primary) ? (
          <a
            href={contactHref(primary)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-crisis-500 px-4 py-2 text-sm font-semibold text-white hover:bg-crisis-600"
          >
            {contactLabel(primary)}
          </a>
        ) : null}
        {textLine && contactHref(textLine) ? (
          <a
            href={contactHref(textLine)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-crisis-300 bg-surface px-4 py-2 text-sm font-semibold text-crisis-700 hover:bg-crisis-50"
          >
            {contactLabel(textLine)}
          </a>
        ) : null}
        {!primary && !textLine ? (
          <a
            href={helplineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-crisis-500 px-4 py-2 text-sm font-semibold text-white hover:bg-crisis-600"
          >
            Find a helpline in your country
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </div>

      {resources && (primary || textLine) ? (
        <p className="mt-3 text-xs text-crisis-700/80">
          {resources.region ? `Helplines for ${resources.region}. ` : ''}
          Not your country? Use{' '}
          <a
            href={helplineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline decoration-crisis-300 underline-offset-2 hover:decoration-crisis-500"
          >
            findahelpline.com
          </a>{' '}
          to find a verified line wherever you are.
        </p>
      ) : null}

      {emergency ? (
        <p className="mt-2 text-xs text-crisis-700/80">
          {emergency.name}
          {emergency.contact ? `: ${emergency.contact}` : ''}. {emergency.available || ''}
        </p>
      ) : null}

      {unavailable ? (
        <p className="mt-2 text-xs text-crisis-700/80">
          We could not load local helplines just now. The international directory above still works.
        </p>
      ) : null}

      {showAllLink ? (
        <div className="mt-4 border-t border-crisis-200 pt-3">
          <Link
            to="/crisis"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-crisis-700 underline decoration-crisis-300 underline-offset-2 hover:decoration-crisis-500"
          >
            All crisis resources, coping tools and international lines →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
