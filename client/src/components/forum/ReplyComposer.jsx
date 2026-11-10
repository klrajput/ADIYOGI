import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import { Checkbox, Textarea } from '../ui/Field';
import SupportCard from './SupportCard';
import { threads } from '../../api/endpoints';
import { useIdentity } from '../../context/IdentityContext';
import { useToast } from '../../context/ToastContext';
import { REPLY_LIMITS } from '../../lib/constants';
import { getErrorMessage, getFieldErrors } from '../../lib/errors';
import { normalizeSupport } from '../../lib/normalize';

/**
 * Inline reply composer. No optimistic rendering: the reply is shown only after
 * the API confirms it, so a failure never looks like success. Handles 429
 * (rate limit) and validation errors explicitly.
 */
export default function ReplyComposer({ threadId, onCreated, disabled = false, className = '' }) {
  const { identity } = useIdentity();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [contentWarning, setContentWarning] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [support, setSupport] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const alias = identity?.preferences?.displayAlias || identity?.alias || '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmed = body.trim();
    if (trimmed.length < REPLY_LIMITS.min) {
      setFieldErrors({ body: `Please write at least ${REPLY_LIMITS.min} characters.` });
      return;
    }
    if (trimmed.length > REPLY_LIMITS.max) {
      setFieldErrors({ body: `Replies can be at most ${REPLY_LIMITS.max} characters.` });
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const { data } = await threads.createReply(threadId, { body: trimmed, contentWarning });
      setBody('');
      setContentWarning(false);
      setSupport(normalizeSupport(data));
      toast.success('Reply posted.');
      onCreated?.();
    } catch (caught) {
      const mapped = getFieldErrors(caught);
      setFieldErrors(mapped);
      if (!mapped.body) {
        setError(getErrorMessage(caught, 'Your reply could not be posted. Please try again.'));
        toast.error(getErrorMessage(caught, 'Your reply could not be posted.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {support ? <SupportCard level={support.level} onDismiss={() => setSupport(null)} /> : null}

      <form onSubmit={handleSubmit} className="card p-4 sm:p-5" aria-label="Write a reply">
        <h2 className="font-serif text-lg text-ink">Add a reply</h2>
        <p className="mt-1 text-xs text-ink-muted">
          {alias ? (
            <>
              You are replying as <span className="font-medium text-ink-muted">{alias}</span>.{' '}
            </>
          ) : null}
          Be kind — someone may be having a hard day.
        </p>

        {error ? (
          <Alert tone="crisis" className="mt-3">
            {error}
          </Alert>
        ) : null}

        <div className="mt-3">
          <Textarea
            label="Your reply"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={REPLY_LIMITS.max}
            rows={4}
            placeholder="Offer support, share what helped you, or simply say you hear them."
            error={fieldErrors.body}
            disabled={submitting}
            hint="Write as much or as little as feels right."
          />
        </div>

        <Checkbox
          label="This reply contains content that may be distressing"
          hint="Adds a content warning so readers can choose to reveal it."
          checked={contentWarning}
          onChange={(event) => setContentWarning(event.target.checked)}
          disabled={submitting}
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            AdiYogi is peer support, not medical advice. See the{' '}
            <Link to="/guidelines" className="link">
              guidelines
            </Link>
            .
          </p>
          <Button type="submit" loading={submitting} disabled={submitting || disabled || body.trim().length === 0}>
            Post reply
          </Button>
        </div>
      </form>
    </div>
  );
}
