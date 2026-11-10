import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Pagination from '../components/ui/Pagination';
import Badge from '../components/ui/Badge';
import { LoadingBlock } from '../components/ui/Spinner';
import PageHeader from '../components/common/PageHeader';
import { Icon } from '../components/common/Icons';
import { notifications } from '../api/endpoints';
import { useIdentity } from '../context/IdentityContext';
import { useToast } from '../context/ToastContext';
import useApiResource from '../hooks/useApiResource';
import usePageTitle from '../hooks/usePageTitle';
import { announceNotificationsChanged } from '../hooks/useUnreadNotifications';
import { NOTIFICATION_TYPE_LABELS } from '../lib/constants';
import { getErrorMessage } from '../lib/errors';
import { asList, normalizeMeta, normalizeNotification } from '../lib/normalize';
import { classNames, timeAgo, truncate } from '../lib/format';

const PAGE_SIZE = 20;

const TYPE_TONES = {
  thread_reply: 'primary',
  moderation: 'accent',
  system: 'neutral',
};

export default function NotificationsPage() {
  usePageTitle('Notifications');

  const { identity, loading: identityLoading, error: identityError, refresh } = useIdentity();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState(null);

  const resource = useApiResource(
    async () =>
      notifications.list({
        ...(filter === 'unread' ? { unreadOnly: true } : {}),
        page,
        limit: PAGE_SIZE,
      }),
    [filter, page],
    { enabled: Boolean(identity) }
  );

  const list = asList(resource.data, ['notifications'])
    .map(normalizeNotification)
    .filter((item) => item && item.id);
  const meta = normalizeMeta(resource.meta);
  // `meta.unreadCount` is authoritative when supplied; on the unread filter the
  // filtered total is the unread count. Otherwise the exact count is unknown and
  // we show none rather than an undercount from the current page.
  const unreadCount =
    typeof meta?.unreadCount === 'number'
      ? meta.unreadCount
      : filter === 'unread'
        ? (meta?.total ?? list.length)
        : null;

  const handleFilterChange = (nextFilter) => {
    setFilter(nextFilter);
    setPage(1);
    setActionError(null);
  };

  const handleMarkOne = async (item) => {
    setBusyId(item.id);
    setActionError(null);
    try {
      await notifications.markRead(item.id);
      announceNotificationsChanged();
      resource.refetch();
    } catch (caught) {
      setActionError(getErrorMessage(caught, 'That notification could not be marked as read.'));
      toast.error(getErrorMessage(caught, 'That notification could not be marked as read.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    setActionError(null);
    try {
      await notifications.markAllRead();
      toast.success('All notifications marked as read.');
      announceNotificationsChanged();
      resource.refetch();
    } catch (caught) {
      setActionError(getErrorMessage(caught, 'Notifications could not be marked as read.'));
      toast.error(getErrorMessage(caught, 'Notifications could not be marked as read.'));
    } finally {
      setMarkingAll(false);
    }
  };

  if (identityLoading && !identity) {
    return (
      <div className="container-narrow py-10 sm:py-14" aria-busy="true">
        <span className="sr-only">Loading notifications</span>
        <div className="skeleton h-4 w-24" />
        <div className="skeleton mt-3 h-9 w-1/2" />
        <div className="mt-8">
          <LoadingBlock label="Loading notifications" rows={3} />
        </div>
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="container-narrow py-16">
        <ErrorState
          title="We could not restore your session"
          description="Notifications belong to your session. Please try reconnecting — nothing has been lost."
          onRetry={refresh}
          retryLabel="Reconnect"
          requestId={identityError?.requestId}
        />
      </div>
    );
  }

  return (
    <div className="container-narrow py-10 sm:py-14">
      <PageHeader
        eyebrow="Your activity"
        title="Notifications"
        description="Replies to your threads and moderation updates. AdiYogi does not send marketing or re-engagement notifications."
        actions={
          <Button
            variant="secondary"
            onClick={handleMarkAll}
            loading={markingAll}
            disabled={markingAll || unreadCount === 0}
          >
            Mark all as read
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter notifications" className="inline-flex rounded-md border border-line bg-surface p-0.5">
          {[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => handleFilterChange(option.value)}
              className={classNames(
                'rounded px-3 py-1.5 text-sm font-medium transition-colors [@media(pointer:coarse)]:min-h-[2.5rem]',
                filter === option.value ? 'bg-primary-700 text-white' : 'text-ink-muted hover:text-ink'
              )}
            >
              {option.label}
              {option.value === 'unread' && unreadCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-crisis-500 px-1.5 text-[11px] font-semibold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {unreadCount > 0 ? (
          <p className="text-sm text-ink-muted" role="status">
            {unreadCount} unread
          </p>
        ) : null}
      </div>

      {actionError ? (
        <p role="alert" className="mt-4 rounded-md border border-crisis-200 bg-crisis-50 px-3 py-2 text-sm text-crisis-700">
          {actionError}
        </p>
      ) : null}

      <div className="mt-6">
        {resource.loading ? (
          <LoadingBlock label="Loading notifications" rows={3} />
        ) : resource.error ? (
          <ErrorState
            title="Notifications could not be loaded"
            description="This is usually temporary. Try again in a moment."
            onRetry={resource.refetch}
            requestId={resource.error?.requestId}
          />
        ) : list.length === 0 ? (
          filter === 'unread' ? (
            <EmptyState
              icon="✓"
              title="You are all caught up"
              description="No unread notifications right now."
              action={
                <Button variant="secondary" onClick={() => handleFilterChange('all')}>
                  View all notifications
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="🔔"
              title="No notifications yet"
              description="When someone replies to a thread you started, it will appear here. Nothing is sent to your email."
              action={
                <Button to="/community" variant="secondary">
                  Browse the community
                </Button>
              }
            />
          )
        ) : (
          <ul className="card overflow-hidden">
            {list.map((item) => {
              const unread = !item.read;
              return (
                <li
                  key={item.id}
                  className={classNames('border-b border-line last:border-b-0', unread && 'bg-primary-50/50')}
                >
                  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={TYPE_TONES[item.type] || 'neutral'}>
                          {NOTIFICATION_TYPE_LABELS[item.type] || 'Update'}
                        </Badge>
                        {unread ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-800">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary-600" />
                            Unread
                          </span>
                        ) : null}
                        <span className="text-xs text-ink-muted">{timeAgo(item.createdAt)}</span>
                      </div>
                      <p
                        className={classNames(
                          'mt-1.5 text-sm leading-relaxed',
                          unread ? 'font-medium text-ink' : 'text-ink-muted'
                        )}
                      >
                        {item.message}
                      </p>
                      {item.threadId ? (
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {/*
                            Notifications are deliberately content-free (generic message + refs)
                            so they never leak a title for content that may later be hidden.
                            We do not resolve titles client-side: GET /threads/:id counts a view
                            and would cost one request per row. The destination page owns the
                            "no longer available" state for hidden/deleted threads.
                          */}
                          <Link
                            to={`/threads/${encodeURIComponent(item.threadId)}`}
                            className="link inline-flex items-center gap-1 text-sm"
                          >
                            Open conversation
                            {item.threadTitle ? `: ${truncate(item.threadTitle, 60)}` : ''}
                            <Icon name="arrow-right" className="h-3.5 w-3.5" />
                          </Link>
                          {item.threadSlug ? (
                            <Link
                              to={`/boards/${encodeURIComponent(item.threadSlug)}`}
                              className="link-quiet text-sm"
                            >
                              Go to board
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {unread ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMarkOne(item)}
                          loading={busyId === item.id}
                          disabled={busyId !== null || markingAll}
                          aria-label={`Mark as read: ${item.message}`}
                        >
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {meta ? <Pagination meta={meta} onPageChange={setPage} className="mt-6" label="notifications" /> : null}

      <p className="mt-8 text-xs leading-relaxed text-ink-muted">
        Notifications are cleared automatically after a retention period; there is no separate mailing list behind
        them. You can turn off the safety strip under the header in{' '}
        <Link to="/preferences" className="link">
          preferences
        </Link>
        .
      </p>
    </div>
  );
}
