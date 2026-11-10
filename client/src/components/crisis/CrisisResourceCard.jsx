import Badge from '../ui/Badge';
import { contactHref, contactLabel, formatVerified } from './resources';

const TYPE_LABELS = {
  phone: 'Phone',
  text: 'Text',
  chat: 'Online chat',
  web: 'Website',
};

/**
 * One verified helpline / emergency entry. Renders a real tel:, sms: or https:
 * link, states availability exactly as the directory does, and shows the
 * verification date honestly (or says that it was not provided).
 */
export default function CrisisResourceCard({ resource, lastVerified, tone = 'default', className = '' }) {
  if (!resource) return null;

  const href = contactHref(resource);
  const isExternal = Boolean(href && /^https?:/i.test(href));
  const verified = formatVerified(resource.verifiedOn || lastVerified);
  const isCrisisTone = tone === 'crisis';

  return (
    <div
      className={`rounded-lg border p-4 ${
        isCrisisTone ? 'border-crisis-200 bg-crisis-50' : 'border-line bg-surface'
      } ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`font-serif text-base ${isCrisisTone ? 'text-crisis-700' : 'text-ink'}`}>
            {resource.name}
          </h3>
          {resource.description ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{resource.description}</p>
          ) : null}
        </div>
        <Badge tone={isCrisisTone ? 'crisis' : 'neutral'}>{TYPE_LABELS[resource.type] || 'Contact'}</Badge>
      </div>

      {resource.contact && resource.type !== 'web' ? (
        <p className={`mt-2 text-sm font-semibold ${isCrisisTone ? 'text-crisis-700' : 'text-ink-soft'}`}>
          {resource.contact}
        </p>
      ) : null}

      {href ? (
        <a
          href={href}
          className={`mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ${
            isCrisisTone
              ? 'bg-crisis-500 text-white hover:bg-crisis-600'
              : 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-paper'
          }`}
          {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {contactLabel(resource)}
          <span aria-hidden="true">{isExternal ? '↗' : '→'}</span>
          {isExternal ? <span className="sr-only">(opens in a new tab)</span> : null}
        </a>
      ) : null}

      <div className="mt-2 space-y-0.5">
        {resource.available ? <p className="text-xs text-ink-muted">{resource.available}</p> : null}
        <p className="text-xs text-ink-muted">
          {verified ? `Details last verified ${verified}.` : 'Verification date not provided.'}
        </p>
      </div>
    </div>
  );
}
