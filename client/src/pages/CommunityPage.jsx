import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { LoadingBlock } from '../components/ui/Spinner';
import PageHeader from '../components/common/PageHeader';
import BoardCard from '../components/forum/BoardCard';
import ThreadListItem from '../components/forum/ThreadListItem';
import { Icon } from '../components/common/Icons';
import { boards, threads } from '../api/endpoints';
import useApiResource from '../hooks/useApiResource';
import usePageTitle from '../hooks/usePageTitle';
import { PEER_SUPPORT_DISCLAIMER } from '../lib/constants';
import { asList, normalizeBoard, normalizeThread } from '../lib/normalize';

const BOARD_SKELETON_COUNT = 6;

function BoardGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      <span className="sr-only">Loading boards</span>
      {Array.from({ length: BOARD_SKELETON_COUNT }).map((_, index) => (
        <div key={index} className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="skeleton h-11 w-11 rounded-lg" />
            <div className="skeleton h-5 w-24 rounded-full" />
          </div>
          <div className="skeleton mt-4 h-4 w-2/3" />
          <div className="skeleton mt-2 h-3 w-full" />
          <div className="skeleton mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function CommunityPage() {
  usePageTitle('Community');

  const boardsResource = useApiResource(async () => boards.list(), []);
  const recentResource = useApiResource(async () => threads.list({ sort: 'recent', limit: 5 }), []);

  const boardList = asList(boardsResource.data, ['boards'])
    .map(normalizeBoard)
    .filter((board) => board && board.slug);
  const boardNames = new Map(boardList.map((entry) => [entry.slug, entry.name]));
  const recentThreads = asList(recentResource.data, ['threads'])
    .map(normalizeThread)
    .filter((thread) => thread && thread.id)
    .map((thread) => ({
      ...thread,
      boardName: thread.boardName || boardNames.get(thread.boardSlug) || '',
    }));

  return (
    <div className="container-page py-10 sm:py-14">
      <PageHeader
        eyebrow="Community"
        title="Find the room that fits"
        description="Every board is a different kind of space, with its own guidelines. Reading is always allowed — you can take part when it feels right."
        actions={
          <>
            <Button to="/guidelines" variant="secondary">
              How posting works
            </Button>
            <Button to="/crisis" variant="ghost" className="text-crisis-700 hover:bg-crisis-50">
              <Icon name="heart" className="h-4 w-4" />
              Get help now
            </Button>
          </>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        <div>
          <section aria-label="Boards">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-2xl text-ink">Boards</h2>
              {!boardsResource.loading && boardList.length > 0 ? (
                <p className="text-sm text-ink-muted">
                  {boardList.length} {boardList.length === 1 ? 'space' : 'spaces'}
                </p>
              ) : null}
            </div>

            <div className="mt-5">
              {boardsResource.loading ? (
                <BoardGridSkeleton />
              ) : boardsResource.error ? (
                <ErrorState
                  title="The board directory could not be loaded"
                  description="This is usually temporary. Try again, or go straight to crisis support if you need it now."
                  onRetry={boardsResource.refetch}
                />
              ) : boardList.length === 0 ? (
                <EmptyState
                  icon="🌱"
                  title="No boards are open yet"
                  description="The community is still being set up. In the meantime, crisis support and the AI companion are available."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button to="/crisis" variant="secondary">
                        Crisis support
                      </Button>
                      <Button to="/chat" variant="ghost">
                        AI companion
                      </Button>
                    </div>
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {boardList.map((board) => (
                    <BoardCard key={board.slug} board={board} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="mt-12" aria-label="Recent conversations">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl text-ink">Recent conversations</h2>
                <p className="mt-1 text-sm text-ink-muted">The latest activity across every board.</p>
              </div>
            </div>

            <div className="mt-5">
              {recentResource.loading ? (
                <LoadingBlock label="Loading recent conversations" rows={3} />
              ) : recentResource.error ? (
                <ErrorState
                  title="Recent conversations could not be loaded"
                  description="The feed is temporarily unavailable. Boards are still readable."
                  onRetry={recentResource.refetch}
                />
              ) : recentThreads.length === 0 ? (
                <EmptyState
                  icon="💬"
                  title="No conversations yet"
                  description="When someone starts a thread it will appear here. You could be the first."
                  action={
                    boardList.length > 0 ? (
                      <Button to={`/boards/${encodeURIComponent(boardList[0].slug)}`} variant="secondary">
                        Visit {boardList[0].name}
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <ul className="card overflow-hidden">
                  {recentThreads.map((thread) => (
                    <ThreadListItem key={thread.id} thread={thread} showBoard />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start" aria-label="Community notes">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-serif text-lg text-ink">
              <Icon name="lock" className="h-4 w-4 text-primary-700" />
              Anonymous by default
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Your alias is generated by the server. There is no public profile, no follower count, and no email
              required to post.
            </p>
            <Link to="/preferences" className="link mt-3 inline-block text-sm">
              Manage your preferences
            </Link>
          </div>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-serif text-lg text-ink">
              <Icon name="flag" className="h-4 w-4 text-primary-700" />
              If something feels wrong
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Every thread and reply can be reported. Reports go to moderators — not to an automated judge,
              and not to a 24/7 team.
            </p>
            <Link to="/guidelines" className="link mt-3 inline-block text-sm">
              Read the reporting process
            </Link>
          </div>

          <p className="px-1 text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
        </aside>
      </div>
    </div>
  );
}
