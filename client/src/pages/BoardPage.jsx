import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Pagination from '../components/ui/Pagination';
import { LoadingBlock } from '../components/ui/Spinner';
import EmptySearch from '../components/common/EmptySearch';
import { Icon } from '../components/common/Icons';
import BoardGuidelines from '../components/forum/BoardGuidelines';
import ThreadFilters from '../components/forum/ThreadFilters';
import ThreadListItem from '../components/forum/ThreadListItem';
import { boards, threads } from '../api/endpoints';
import useApiResource from '../hooks/useApiResource';
import useDebouncedValue from '../hooks/useDebouncedValue';
import usePageTitle from '../hooks/usePageTitle';
import { BOARD_SUPPORT_LEVELS, DEFAULT_THREAD_SORT } from '../lib/constants';
import { isNotFound } from '../lib/errors';
import { asEntity, asList, normalizeBoard, normalizeMeta, normalizeThread } from '../lib/normalize';
import { timeAgo } from '../lib/format';

const PAGE_SIZE = 20;

function BoardHeaderSkeleton() {
  return (
    <div aria-busy="true" className="card p-5 sm:p-6">
      <span className="sr-only">Loading board</span>
      <div className="flex items-start gap-4">
        <div className="skeleton h-12 w-12 rounded-lg" />
        <div className="flex-1">
          <div className="skeleton h-6 w-1/3" />
          <div className="skeleton mt-3 h-3 w-2/3" />
          <div className="skeleton mt-2 h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { slug = '' } = useParams();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(DEFAULT_THREAD_SORT);
  const [tag, setTag] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q, 350);

  const boardResource = useApiResource(async () => boards.get(slug), [slug]);
  const board = normalizeBoard(asEntity(boardResource.data, ['board']));
  const boardMissing = Boolean(boardResource.error && isNotFound(boardResource.error));

  const threadsResource = useApiResource(
    async () =>
      threads.list({
        board: slug,
        q: debouncedQ || undefined,
        sort,
        tag: tag || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [slug, debouncedQ, sort, tag, page]
  );

  const threadList = asList(threadsResource.data, ['threads'])
    .map(normalizeThread)
    .filter((thread) => thread && thread.id);
  const meta = normalizeMeta(threadsResource.meta);
  const hasFilters = Boolean(debouncedQ || tag);

  usePageTitle(board ? board.name : 'Board');

  const handleQChange = (value) => {
    setQ(value);
    setPage(1);
  };
  const handleSortChange = (value) => {
    setSort(value);
    setPage(1);
  };
  const handleTagChange = (value) => {
    setTag(value);
    setPage(1);
  };
  const clearFilters = () => {
    setQ('');
    setTag('');
    setPage(1);
  };

  if (boardResource.loading) {
    return (
      <div className="container-page py-10 sm:py-14">
        <BoardHeaderSkeleton />
        <div className="mt-8">
          <LoadingBlock label="Loading threads" rows={4} />
        </div>
      </div>
    );
  }

  if (boardMissing) {
    return (
      <div className="container-narrow py-16">
        <div className="card p-8 text-center">
          <span aria-hidden="true" className="text-3xl">
            🌿
          </span>
          <h1 className="mt-3 font-serif text-2xl text-ink">This board is not here</h1>
          <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            The board may have been renamed or closed. The rest of the community is still open.
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

  if (boardResource.error || !board) {
    return (
      <div className="container-narrow py-16">
        <ErrorState
          title="This board could not be loaded"
          description="Please try again. If you need support right now, crisis resources are always available."
          onRetry={boardResource.refetch}
          requestId={boardResource.error?.requestId}
        />
      </div>
    );
  }

  const support = BOARD_SUPPORT_LEVELS[board.supportLevel] || BOARD_SUPPORT_LEVELS.general;

  return (
    <div className="container-page py-10 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink-muted">
        <Link to="/community" className="inline-flex items-center gap-1.5 hover:text-ink">
          <Icon name="arrow-left" className="h-4 w-4" />
          All boards
        </Link>
      </nav>

      <header className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-2xl"
            >
              {board.icon || <Icon name="community" className="h-6 w-6 text-primary-700" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words font-serif text-2xl leading-tight text-ink sm:text-3xl">{board.name}</h1>
                <Badge tone={support.tone}>{support.label}</Badge>
              </div>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{board.description}</p>
              <p className="mt-2 text-xs text-ink-muted">
                {board.threadCount !== null ? (
                  <span>
                    {board.threadCount} {board.threadCount === 1 ? 'thread' : 'threads'}
                  </span>
                ) : null}
                {board.threadCount !== null && board.lastActivityAt ? <span aria-hidden="true"> · </span> : null}
                {board.lastActivityAt ? <span>Last activity {timeAgo(board.lastActivityAt)}</span> : null}
              </p>
            </div>
          </div>
          <Button to={`/boards/${encodeURIComponent(board.slug)}/new`} className="shrink-0">
            <Icon name="plus" className="h-4 w-4" />
            Start a thread
          </Button>
        </div>
        <div className="mt-5">
          <BoardGuidelines guidelines={board.guidelines} />
        </div>
      </header>

      <div className="mt-6">
        <ThreadFilters
          q={q}
          onQChange={handleQChange}
          sort={sort}
          onSortChange={handleSortChange}
          tags={board.tags}
          activeTag={tag}
          onTagChange={handleTagChange}
          loading={threadsResource.loading}
        />
      </div>

      <section className="mt-6" aria-label="Threads">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl text-ink">Threads</h2>
          {meta ? (
            <p className="text-sm text-ink-muted" role="status">
              {meta.total} {meta.total === 1 ? 'conversation' : 'conversations'}
              {hasFilters ? ' matching your filters' : ''}
            </p>
          ) : null}
        </div>

        {threadsResource.loading ? (
          <LoadingBlock label="Loading threads" rows={4} />
        ) : threadsResource.error ? (
          <ErrorState
            title="Threads could not be loaded"
            description="This list is temporarily unavailable. Try again in a moment."
            onRetry={threadsResource.refetch}
            requestId={threadsResource.error?.requestId}
          />
        ) : threadList.length === 0 ? (
          hasFilters ? (
            <EmptySearch
              title="No threads match those filters"
              description="Try a different search, another tag, or clear the filters to see everything on this board."
              onClear={clearFilters}
              clearLabel="Clear filters"
            />
          ) : (
            <EmptyState
              icon="🌱"
              title="No threads here yet"
              description="This board is quiet right now. If you feel ready, your experience could be the first thing someone reads."
              action={
                <Button to={`/boards/${encodeURIComponent(board.slug)}/new`} variant="secondary">
                  Start the first thread
                </Button>
              }
            />
          )
        ) : (
          <ul className="card overflow-hidden">
            {threadList.map((thread) => (
              <ThreadListItem key={thread.id} thread={thread} />
            ))}
          </ul>
        )}

        {meta ? (
          <Pagination meta={meta} onPageChange={setPage} className="mt-6" label={`${board.name} threads`} />
        ) : null}
      </section>
    </div>
  );
}
