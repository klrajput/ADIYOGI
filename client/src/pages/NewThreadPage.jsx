import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ErrorState from '../components/ui/ErrorState';
import { Checkbox, Input, Textarea } from '../components/ui/Field';
import { Icon } from '../components/common/Icons';
import BoardGuidelines from '../components/forum/BoardGuidelines';
import SupportCard from '../components/forum/SupportCard';
import { boards, crisis, threads } from '../api/endpoints';
import { useIdentity } from '../context/IdentityContext';
import { useToast } from '../context/ToastContext';
import useApiResource from '../hooks/useApiResource';
import useDebouncedValue from '../hooks/useDebouncedValue';
import usePageTitle from '../hooks/usePageTitle';
import { CRISIS_ASSESS_MIN_LENGTH, PEER_SUPPORT_DISCLAIMER, THREAD_LIMITS } from '../lib/constants';
import { getErrorMessage, getFieldErrors, isNotFound } from '../lib/errors';
import {
  asEntity,
  normalizeAssessment,
  normalizeBoard,
  normalizeSupport,
  normalizeThread,
} from '../lib/normalize';

function parseTags(value) {
  const unique = [];
  value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .forEach((tag) => {
      if (!unique.includes(tag)) unique.push(tag);
    });
  return unique;
}

export default function NewThreadPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { identity } = useIdentity();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [contentWarning, setContentWarning] = useState(false);
  const [cwTouched, setCwTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [assessmentDismissed, setAssessmentDismissed] = useState(false);

  const boardResource = useApiResource(async () => boards.get(slug), [slug]);
  const board = normalizeBoard(asEntity(boardResource.data, ['board']));
  const boardMissing = Boolean(boardResource.error && isNotFound(boardResource.error));
  const alias = identity?.preferences?.displayAlias || identity?.alias || '';
  const tags = parseTags(tagsInput);

  usePageTitle(board ? `New thread in ${board.name}` : 'New thread');

  // Respect the saved content-warning default until the author changes it.
  useEffect(() => {
    if (cwTouched) return;
    if (identity?.preferences?.contentWarningDefault) setContentWarning(true);
  }, [identity, cwTouched]);

  // Debounced, non-blocking crisis assessment of the draft body. Re-assessing is
  // skipped for small edits so a long post does not burn through the assess rate
  // limit. A failure here never blocks posting — the server assesses on submit.
  const debouncedBody = useDebouncedValue(body, 900);
  const canAssess = debouncedBody.trim().length >= CRISIS_ASSESS_MIN_LENGTH;
  const lastAssessedRef = useRef({ length: 0 });
  useEffect(() => {
    if (!canAssess) {
      setAssessment(null);
      lastAssessedRef.current = { length: 0 };
      return undefined;
    }
    const trimmed = debouncedBody.trim();
    if (lastAssessedRef.current.length > 0 && Math.abs(trimmed.length - lastAssessedRef.current.length) < 40) {
      return undefined;
    }
    lastAssessedRef.current = { length: trimmed.length };
    let active = true;
    crisis
      .assess({ text: trimmed, source: 'content' })
      .then(({ data }) => {
        if (active) setAssessment(normalizeAssessment(data));
      })
      .catch(() => {
        if (active) setAssessment(null);
      });
    return () => {
      active = false;
    };
  }, [debouncedBody, canAssess]);

  const validate = () => {
    const next = {};
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (trimmedTitle.length < THREAD_LIMITS.titleMin) {
      next.title = `Please write a title of at least ${THREAD_LIMITS.titleMin} characters.`;
    } else if (trimmedTitle.length > THREAD_LIMITS.titleMax) {
      next.title = `Titles can be at most ${THREAD_LIMITS.titleMax} characters.`;
    }

    if (trimmedBody.length < THREAD_LIMITS.bodyMin) {
      next.body = `Please write at least ${THREAD_LIMITS.bodyMin} characters so people can understand what you are sharing.`;
    } else if (trimmedBody.length > THREAD_LIMITS.bodyMax) {
      next.body = `Posts can be at most ${THREAD_LIMITS.bodyMax} characters.`;
    }

    if (tags.length > THREAD_LIMITS.tagsMax) {
      next.tags = `Choose at most ${THREAD_LIMITS.tagsMax} tags.`;
    } else if (tags.some((tag) => tag.length > THREAD_LIMITS.tagMaxLength)) {
      next.tags = `Each tag can be at most ${THREAD_LIMITS.tagMaxLength} characters.`;
    }

    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const { data } = await threads.create({
        boardSlug: slug,
        title: title.trim(),
        body: body.trim(),
        tags,
        contentWarning,
      });
      const created = normalizeThread(asEntity(data, ['thread']));
      const support = normalizeSupport(data);
      toast.success('Your thread is published.');
      if (created?.id) {
        navigate(`/threads/${encodeURIComponent(created.id)}`, { state: support ? { support } : null });
      } else {
        navigate(`/boards/${encodeURIComponent(slug)}`);
      }
    } catch (caught) {
      const mapped = getFieldErrors(caught);
      setErrors(mapped);
      const hasFieldError = Object.keys(mapped).length > 0;
      if (!hasFieldError) {
        setFormError(getErrorMessage(caught, 'Your thread could not be posted. Please try again.'));
      }
      toast.error(getErrorMessage(caught, 'Your thread could not be posted.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (boardResource.loading) {
    return (
      <div className="container-narrow py-10 sm:py-14">
        <div className="skeleton h-4 w-32" />
        <div className="skeleton mt-4 h-9 w-2/3" />
        <div className="skeleton mt-3 h-4 w-1/2" />
        <div className="card mt-8 p-6" aria-busy="true">
          <span className="sr-only">Loading the board</span>
          <div className="skeleton h-4 w-24" />
          <div className="skeleton mt-3 h-11 w-full" />
          <div className="skeleton mt-6 h-4 w-24" />
          <div className="skeleton mt-3 h-40 w-full" />
        </div>
      </div>
    );
  }

  if (boardMissing) {
    return (
      <div className="container-narrow py-16">
        <div className="card p-8 text-center">
          <h1 className="font-serif text-2xl text-ink">That board does not exist</h1>
          <p className="mt-2 text-sm text-ink-muted">Choose a board from the community directory to start a thread.</p>
          <div className="mt-6">
            <Button to="/community">Browse boards</Button>
          </div>
        </div>
      </div>
    );
  }

  if (boardResource.error || !board) {
    return (
      <div className="container-narrow py-16">
        <ErrorState
          title="The board could not be loaded"
          description="Please try again in a moment."
          onRetry={boardResource.refetch}
          requestId={boardResource.error?.requestId}
        />
      </div>
    );
  }

  const showSupport = assessment && !assessmentDismissed && (assessment.level === 'elevated' || assessment.level === 'high');

  return (
    <div className="container-page py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink-muted">
        <Link to={`/boards/${encodeURIComponent(board.slug)}`} className="inline-flex items-center gap-1.5 hover:text-ink">
          <Icon name="arrow-left" className="h-4 w-4" />
          Back to {board.name}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="min-w-0">
          <h1 className="break-words font-serif text-3xl leading-tight text-ink sm:text-4xl">Start a thread in {board.name}</h1>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted sm:text-base">
            Write at your own pace. You can delete your thread later, and everything is posted under your anonymous
            alias.
          </p>

          {formError ? (
            <Alert tone="crisis" className="mt-5">
              {formError}
            </Alert>
          ) : null}

          {showSupport ? (
            <SupportCard
              level={assessment.level}
              className="mt-5"
              onDismiss={() => setAssessmentDismissed(true)}
            />
          ) : null}

          <form onSubmit={handleSubmit} className="card mt-6 p-5 sm:p-6" noValidate>
            <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-line pb-5 text-sm">
              <Badge tone="primary">
                <Icon name="lock" className="h-3 w-3" />
                Anonymous
              </Badge>
              <span className="text-ink-muted">
                Posting as <span className="font-medium text-ink">{alias || 'your anonymous alias'}</span>
              </span>
            </div>

            <Input
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={THREAD_LIMITS.titleMax}
              placeholder="A few words that describe what you want to share"
              error={errors.title}
              hint={`${title.trim().length} / ${THREAD_LIMITS.titleMax} characters`}
              required
              disabled={submitting}
            />

            <Textarea
              label="Your post"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={THREAD_LIMITS.bodyMax}
              rows={10}
              placeholder="What is on your mind? You do not have to explain everything at once."
              error={errors.body}
              hint={`At least ${THREAD_LIMITS.bodyMin} characters. Plain text only — no HTML or links needed.`}
              required
              disabled={submitting}
            />

            <div className="mb-1 mt-2">
              <label htmlFor="thread-tags" className="label">
                Tags <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input
                id="thread-tags"
                type="text"
                className="input"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                placeholder="e.g. sleep, work-stress, grief"
                aria-describedby="thread-tags-hint"
                disabled={submitting}
              />
              {errors.tags ? (
                <p className="field-error" role="alert">
                  {errors.tags}
                </p>
              ) : (
                <p id="thread-tags-hint" className="hint text-ink-muted">
                  Comma separated, up to {THREAD_LIMITS.tagsMax} tags, lowercase.
                </p>
              )}
              {tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="badge-neutral">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-5">
              <Checkbox
                label="Add a content warning"
                hint="Use this if your post describes self-harm, abuse, graphic experiences, or anything a reader might need to prepare for."
                checked={contentWarning}
                onChange={(event) => {
                  setCwTouched(true);
                  setContentWarning(event.target.checked);
                }}
                disabled={submitting}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <Link to={`/boards/${encodeURIComponent(board.slug)}`} className="btn-ghost">
                Cancel
              </Link>
              <Button type="submit" loading={submitting} disabled={submitting}>
                Post thread
              </Button>
            </div>
          </form>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start" aria-label="Posting guidance">
          <BoardGuidelines guidelines={board.guidelines} />

          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-serif text-lg text-ink">
              <Icon name="info" className="h-4 w-4 text-primary-700" />
              Before you post
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-muted">
              <li>No medical advice, dosages, or diagnoses — for yourself or anyone else.</li>
              <li>Do not share identifying details about yourself or another person.</li>
              <li>Use a content warning if your post could be difficult to read.</li>
              <li>Your thread can be reported by others and reviewed by moderators.</li>
            </ul>
            <Link to="/guidelines" className="link mt-3 inline-block text-sm">
              Read the full guidelines
            </Link>
          </div>

          <div className="rounded-lg border border-line bg-paper p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon name="heart" className="h-4 w-4 text-primary-700" />
              If this is urgent
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Posting is not a way to reach emergency help. If you are in danger or thinking about harming yourself,
              please contact a crisis line now.
            </p>
            <Button to="/crisis" variant="crisis" size="sm" className="mt-3">
              Crisis support
            </Button>
          </div>

          <p className="px-1 text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
        </aside>
      </div>
    </div>
  );
}
