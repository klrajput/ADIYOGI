import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Pagination from '../components/ui/Pagination';
import { LoadingBlock } from '../components/ui/Spinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { Icon } from '../components/common/Icons';
import ContentWarningBlock from '../components/forum/ContentWarningBlock';
import ReplyComposer from '../components/forum/ReplyComposer';
import ReportDialog from '../components/forum/ReportDialog';
import SupportCard from '../components/forum/SupportCard';
import { replies as repliesApi, threads } from '../api/endpoints';
import { useIdentity } from '../context/IdentityContext';
import { useToast } from '../context/ToastContext';
import useApiResource from '../hooks/useApiResource';
import usePageTitle from '../hooks/usePageTitle';
import { PEER_SUPPORT_DISCLAIMER } from '../lib/constants';
import { getErrorMessage, isNotFound } from '../lib/errors';
import { asEntity, asList, normalizeMeta, normalizeReply, normalizeThread } from '../lib/normalize';
import { formatCount, humanizeSlug, timeAgo } from '../lib/format';

const REPLY_PAGE_SIZE = 20;

function ThreadSkeleton() {
  return (
    <div className="container-narrow py-10 sm:py-14" aria-busy="true">
      <span className="sr-only">Loading thread</span>
      <div className="card p-6">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-4 h-8 w-3/4" />
        <div className="skeleton mt-3 h-3 w-40" />
        <div className="skeleton mt-6 h-3 w-full" />
        <div className="skeleton mt-2 h-3 w-full" />
        <div className="skeleton mt-2 h-3 w-2/3" />
      </div>
      <div className="mt-6">
        <LoadingBlock label="Loading replies" rows={2} />
      </div>
    </div>
  );
}

export default function ThreadPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { identity } = useIdentity();

  const [replyPage, setReplyPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [support, setSupport] = useState(() => location.state?.support || null);

  const threadResource = useApiResource(async () => threads.get(id), [id]);
  const thread = normalizeThread(asEntity(threadResource.data, ['thread']));
  const threadMissing = Boolean(threadResource.error && isNotFound(threadResource.error));

  const repliesResource = useApiResource(
    async () => threads.replies(id, { page: replyPage, limit: REPLY_PAGE_SIZE, sort: 'new' }),
    [id, replyPage]
  );

  const replyList = asList(repliesResource.data, ['replies'])
    .map(normalizeReply)
    .filter((reply) => reply && reply.id);
  const repliesMeta = normalizeMeta(repliesResource.meta);

  usePageTitle(thread ? thread.title : 'Thread');

  // The creation response may include a support payload; show it once, then
  // clear the navigation state so a refresh does not resurrect it.
  useEffect(() => {
    if (location.state?.support) {
      setSupport(location.state.support);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const refetchConversation = () => {
    threadResource.refetch();
    repliesResource.refetch();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'thread') {
        await threads.remove(deleteTarget.id);
        toast.success('Your thread has been deleted.');
        if (thread?.boardSlug) navigate(`/boards/${encodeURIComponent(thread.boardSlug)}`);
        else navigate('/community');
        return;
      }
      await repliesApi.remove(deleteTarget.id);
      toast.success('Your reply has been deleted.');
      setDeleteTarget(null);
      threadResource.refetch();
      if (replyList.length === 1 && replyPage > 1) setReplyPage((current) => current - 1);
      else repliesResource.refetch();
    } catch (caught) {
      toast.error(getErrorMessage(caught, 'That could not be deleted. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  if (threadResource.loading) return <ThreadSkeleton />;

  if (threadMissing) {
    return (
      <div className="container-narrow py-16">
        <div className="card p-8 text-center">
          <p className="eyebrow text-ink-muted">Not available</p>
          <h1 className="mt-2 font-serif text-2xl text-ink">This conversation is not here</h1>
          <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            It may have been deleted or hidden by moderation. Other conversations are still open, and crisis support is
            always available.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button to="/community">Browse boards</Button>
            <Button to="/crisis" variant="secondary">
              Crisis support
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (threadResource.error || !thread) {
    return (
      <div className="container-narrow py-16">
        <ErrorState
          title="This conversation could not be loaded"
          description="Please try again. If you need support right now, crisis resources are always available."
          onRetry={threadResource.refetch}
          requestId={threadResource.error?.requestId}
        />
      </div>
    );
  }

  const boardLabel = thread.boardName || humanizeSlug(thread.boardSlug);
  const views = formatCount(thread.viewCount);
  const repliesLabel =
    thread.replyCount === null
      ? null
      : thread.replyCount === 0
        ? 'No replies yet'
        : `${thread.replyCount} ${thread.replyCount === 1 ? 'reply' : 'replies'}`;

  return (
    <div className="container-narrow py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <Link to="/community" className="hover:text-ink">
          Community
        </Link>
        {thread.boardSlug ? (
          <>
            <Icon name="chevron-right" className="h-3.5 w-3.5 text-ink-muted" />
            <Link to={`/boards/${encodeURIComponent(thread.boardSlug)}`} className="hover:text-ink">
              {boardLabel}
            </Link>
          </>
        ) : null}
      </nav>

      {support ? (
        <SupportCard level={support.level} className="mb-5" onDismiss={() => setSupport(null)} />
      ) : null}

      <article className="card overflow-hidden">
        <header className="border-b border-line/80 bg-gradient-to-br from-surface via-surface to-accent-50/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {thread.isPinned ? (
              <Badge tone="accent">
                <Icon name="shield" className="h-3 w-3" />
                Pinned
              </Badge>
            ) : null}
            {thread.isLocked ? (
              <Badge tone="neutral">
                <Icon name="lock" className="h-3 w-3" />
                Locked
              </Badge>
            ) : null}
            {thread.contentWarning ? (
              <Badge tone="crisis">
                <Icon name="warning" className="h-3 w-3" />
                Content warning
              </Badge>
            ) : null}
            <span className="ml-auto text-xs text-ink-muted">{timeAgo(thread.createdAt)}</span>
          </div>

          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            {thread.boardName || thread.boardSlug || 'Community'} · anonymous conversation
          </p>
          <h1 className="mt-1 break-words font-serif text-2xl leading-tight text-ink sm:text-[2rem]">{thread.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span className="font-medium text-ink-muted">{thread.authorAlias}</span>
            {views !== null ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="eye" className="h-3.5 w-3.5" />
                {views} views
              </span>
            ) : null}
            {repliesLabel ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="message" className="h-3.5 w-3.5" />
                {repliesLabel}
              </span>
            ) : null}
            {thread.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-ink-muted">
                #{tag}
              </span>
            ))}
          </div>
        </header>

        <div className="p-5 sm:p-6">
          {thread.contentWarning ? (
            <ContentWarningBlock preview={thread.body}>
              <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-soft">
                {thread.body}
              </div>
            </ContentWarningBlock>
          ) : (
            <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-soft">
              {thread.body}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReportTarget({ targetType: 'thread', targetId: thread.id, label: 'this thread' })}
            >
              <Icon name="flag" className="h-4 w-4" />
              Report
            </Button>
            {thread.canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-crisis-700 hover:bg-crisis-50"
                onClick={() => setDeleteTarget({ type: 'thread', id: thread.id, title: thread.title })}
              >
                <Icon name="trash" className="h-4 w-4" />
                Delete thread
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-ink-muted">Posted under an anonymous alias.</p>
        </footer>
      </article>

      <section className="mt-8" aria-label="Replies">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="font-serif text-xl text-ink">Replies</h2>
          {repliesMeta ? (
            <p className="text-sm text-ink-muted" role="status">
              {repliesMeta.total} {repliesMeta.total === 1 ? 'reply' : 'replies'}
            </p>
          ) : null}
        </div>

        {repliesResource.loading ? (
          <LoadingBlock label="Loading replies" rows={2} />
        ) : repliesResource.error ? (
          <ErrorState
            title="Replies could not be loaded"
            description="The conversation is still here — please try loading the replies again."
            onRetry={repliesResource.refetch}
            requestId={repliesResource.error?.requestId}
          />
        ) : replyList.length === 0 ? (
          <EmptyState
            icon="💬"
            title="No replies yet"
            description="You can be the first person to respond. A short, kind reply is often enough."
          />
        ) : (
          <ul className="space-y-4">
            {replyList.map((reply) => (
              <li key={reply.id} className="card p-5">
                <article aria-label={`Reply by ${reply.authorAlias}`}>
                  <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span className="font-medium text-ink-muted">{reply.authorAlias}</span>
                    <span>{timeAgo(reply.createdAt)}</span>
                    {reply.contentWarning ? (
                      <Badge tone="crisis">
                        <Icon name="warning" className="h-3 w-3" />
                        Content warning
                      </Badge>
                    ) : null}
                  </header>
                  <div className="mt-3">
                    {reply.contentWarning ? (
                      <ContentWarningBlock preview={reply.body}>
                        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
                          {reply.body}
                        </div>
                      </ContentWarningBlock>
                    ) : (
                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
                        {reply.body}
                      </div>
                    )}
                  </div>
                  <footer className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setReportTarget({ targetType: 'reply', targetId: reply.id, label: 'this reply' })
                      }
                    >
                      <Icon name="flag" className="h-4 w-4" />
                      Report
                    </Button>
                    {reply.canDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-crisis-700 hover:bg-crisis-50"
                        onClick={() => setDeleteTarget({ type: 'reply', id: reply.id, title: 'this reply' })}
                      >
                        <Icon name="trash" className="h-4 w-4" />
                        Delete
                      </Button>
                    ) : null}
                  </footer>
                </article>
              </li>
            ))}
          </ul>
        )}

        {repliesMeta ? (
          <Pagination
            meta={repliesMeta}
            onPageChange={setReplyPage}
            className="mt-5"
            label={`replies to ${thread.title}`}
          />
        ) : null}
      </section>

      <section className="mt-8" aria-label="Add a reply">
        {thread.isLocked ? (
          <Alert tone="info" title="This thread is locked">
            New replies are paused on this thread. If you need to talk, you can start your own thread in{' '}
            {boardLabel || 'the community'} or reach crisis support.
            <div className="mt-3 flex flex-wrap gap-2">
              {thread.boardSlug ? (
                <Button to={`/boards/${encodeURIComponent(thread.boardSlug)}/new`} variant="secondary" size="sm">
                  Start a new thread
                </Button>
              ) : null}
              <Button to="/crisis" variant="ghost" size="sm">
                Crisis support
              </Button>
            </div>
          </Alert>
        ) : (
          <ReplyComposer
            threadId={thread.id}
            onCreated={() => {
              // Newest-first ordering means the new reply is on page 1.
              setReplyPage(1);
              refetchConversation();
            }}
          />
        )}
      </section>

      <p className="mt-8 text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title={deleteTarget?.type === 'thread' ? 'Delete this thread?' : 'Delete this reply?'}
        description="This removes it from the community. It cannot be restored from your side."
        confirmLabel={deleteTarget?.type === 'thread' ? 'Delete thread' : 'Delete reply'}
      >
        {deleteTarget?.type === 'thread' ? (
          <p className="whitespace-pre-wrap break-words text-sm text-ink-muted">{deleteTarget.title}</p>
        ) : null}
      </ConfirmDialog>

      <ReportDialog
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.targetType}
        targetId={reportTarget?.targetId}
        targetLabel={reportTarget?.label}
        onReported={() => setReportTarget(null)}
      />

      {identity?.kind === 'anonymous' ? (
        <p className="mt-4 text-xs text-ink-muted">
          You are posting anonymously. <Link to="/login" className="link">Signing in</Link> is optional and only needed
          for moderator tools and continuity across devices.
        </p>
      ) : null}
    </div>
  );
}
