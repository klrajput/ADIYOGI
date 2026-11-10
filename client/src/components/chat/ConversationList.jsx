import { timeAgo, truncate } from '../../lib/format';

function SkeletonRow() {
  return (
    <li className="px-3 py-3">
      <div className="skeleton h-3.5 w-2/3" />
      <div className="skeleton mt-2 h-2.5 w-1/3" />
    </li>
  );
}

/**
 * Conversation browser used in the desktop sidebar and the mobile sheet.
 * Selecting and deleting are both real, keyboard-accessible controls; deletion is
 * confirmed by the page before it happens.
 */
export default function ConversationList({
  conversations = [],
  activeId = null,
  loading = false,
  error = null,
  onRetry,
  onSelect,
  onDelete,
  onNew,
  meta = null,
  loadingMore = false,
  onLoadMore,
}) {
  const hasMore = Boolean(meta?.hasNext);
  const isEmpty = !loading && !error && conversations.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-3">
        <h2 className="font-serif text-sm font-semibold text-ink">Conversations</h2>
        <button type="button" className="btn-secondary btn-sm min-h-[40px]" onClick={onNew}>
          New conversation
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <ul className="divide-y divide-line">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </ul>
        ) : null}

        {!loading && error ? (
          <div className="px-3 py-4" role="alert">
            <p className="text-sm text-crisis-700">We could not load your conversations.</p>
            <p className="mt-1 text-xs text-ink-muted">
              Your messages are safe; this list just failed to load.
            </p>
            <button type="button" className="btn-secondary btn-sm mt-2 min-h-[40px]" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-medium text-ink">No conversations yet</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Start a conversation to see it listed here.
            </p>
          </div>
        ) : null}

        {!error && conversations.length > 0 ? (
          <ul className="divide-y divide-line">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeId;
              return (
                <li key={conversation.id} className={`flex items-stretch gap-1 px-1.5 ${isActive ? 'bg-primary-50' : ''}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    aria-current={isActive ? 'true' : undefined}
                    className="min-w-0 flex-1 rounded px-2 py-3 text-left hover:bg-ink/5"
                  >
                    <span className={`block truncate text-sm ${isActive ? 'font-semibold text-primary-900' : 'font-medium text-ink'}`}>
                      {conversation.title || 'Untitled conversation'}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                      {conversation.lastMessageAt ? (
                        <time dateTime={conversation.lastMessageAt}>
                          {timeAgo(conversation.lastMessageAt)}
                        </time>
                      ) : (
                        <span>No messages yet</span>
                      )}
                      {typeof conversation.messageCount === 'number' ? (
                        <span aria-hidden="true">· {conversation.messageCount} messages</span>
                      ) : null}
                    </span>
                    {conversation.lastMessagePreview ? (
                      <span className="mt-1 block truncate text-xs text-ink-muted">
                        {truncate(conversation.lastMessagePreview, 70)}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(conversation)}
                    className="my-2 shrink-0 self-center rounded-md px-2 py-2 text-xs font-medium text-ink-muted hover:bg-crisis-50 hover:text-crisis-700"
                    aria-label={`Delete conversation ${conversation.title || 'Untitled conversation'}`}
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {hasMore ? (
        <div className="border-t border-line p-2">
          <button
            type="button"
            className="btn-secondary w-full min-h-[40px] text-xs"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load older conversations'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
