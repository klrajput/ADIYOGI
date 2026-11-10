import { useState } from 'react';
import { Link } from 'react-router-dom';
import GuidedExercisePanel from './GuidedExercisePanel';

function detailsObject(error) {
  return error && typeof error.details === 'object' && !Array.isArray(error.details) ? error.details : {};
}

/**
 * Honest, specific error state for a failed chat send. Every branch offers a way
 * forward, keeps the user's draft (the parent restores it), and shows a crisis
 * route. A 503 from the AI provider is never dressed up as a reply: the UI says
 * plainly that no answer was generated and offers the non-AI guided exercise when
 * the server provides one.
 */
export default function ApiErrorCard({ error, onRetry, retryLabel = 'Try again', className = '' }) {
  const [guidedOpen, setGuidedOpen] = useState(false);
  if (!error) return null;

  const details = detailsObject(error);
  const isAiUnavailable = error.status === 503 || error.code === 'AI_UNAVAILABLE';
  const isRateLimited = error.status === 429 || error.code === 'RATE_LIMITED';
  const isNetwork = error.status === 0 || error.code === 'NETWORK_ERROR' || error.isNetworkError;
  const isContentBlocked = error.code === 'CONTENT_BLOCKED' || error.status === 422;
  const guidedExercise = details.guidedExercise || null;
  const retryAfterRaw = details.retryAfterSeconds ?? details.retryAfter;
  const retryAfterSeconds = Number(retryAfterRaw);
  const waitHint =
    Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? `The service asked us to wait about ${retryAfterSeconds} second${
          retryAfterSeconds === 1 ? '' : 's'
        } before retrying.`
      : '';

  let title = 'Your message was not sent';
  let description =
    error.message || 'Something interrupted the request. Your draft is still in the box below.';
  let showRetry = Boolean(onRetry);

  if (isAiUnavailable) {
    title = 'The AI companion is unavailable right now';
    description =
      'No reply was generated — we do not fill in fake AI text. You can try again, or use a non-AI option below.';
    showRetry = Boolean(onRetry);
  } else if (isRateLimited) {
    title = 'You are sending messages a little quickly';
    description = `To keep the chat available for everyone, messages are rate limited. ${
      waitHint || 'Please wait a moment before trying again.'
    } Your draft has been kept.`;
  } else if (isNetwork) {
    title = 'We could not reach AdiYogi';
    description =
      'Check your connection and try again. Nothing has been lost — your message is still in the box below.';
  } else if (isContentBlocked) {
    title = 'That message could not be sent';
    description =
      error.message ||
      'Something in the message was blocked by our content rules. You can edit it and send again.';
    showRetry = false;
  }

  return (
    <div role="alert" className={`rounded-lg border border-accent-200 bg-accent-50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-lg leading-6">
          ⚠️
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-base text-accent-800">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-accent-800">{description}</p>
          {error.requestId ? (
            <p className="mt-1 text-xs text-accent-700/80">Reference: {error.requestId}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {showRetry ? (
              <button type="button" className="btn-primary min-h-[40px]" onClick={onRetry}>
                {retryLabel}
              </button>
            ) : null}
            <Link to="/crisis" className="btn-crisis min-h-[40px]">
              Get crisis resources
            </Link>
          </div>

          {guidedExercise ? (
            <>
              <GuidedExercisePanel
                exercise={guidedExercise}
                expanded={guidedOpen}
                onToggle={() => setGuidedOpen((current) => !current)}
              />
              <p className="mt-2 text-xs text-accent-800/80">
                If you are in crisis, use a phone line on the crisis page — an exercise is not a
                substitute for human help.
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs text-accent-800/80">
              If you are in immediate danger, please call your local emergency number or open the
              crisis page for verified helplines.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
