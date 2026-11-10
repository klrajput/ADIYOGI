import Button from './Button';

/**
 * Error state for failed fetches/mutations. Always offers a recovery action and
 * never shows raw stack traces or internal ids to the user.
 */
export default function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this right now. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  requestId,
}) {
  return (
    <div role="alert" className="rounded-lg border border-crisis-200 bg-crisis-50 px-6 py-8 text-center">
      <div aria-hidden="true" className="text-2xl">
        ⚠️
      </div>
      <h3 className="mt-3 font-serif text-lg text-crisis-700">{title}</h3>
      <p className="mx-auto mt-2 max-w-prose text-sm text-crisis-700/90">{description}</p>
      {onRetry ? (
        <div className="mt-5">
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
      {requestId ? <p className="mt-4 text-xs text-crisis-600/80">Reference: {requestId}</p> : null}
    </div>
  );
}
