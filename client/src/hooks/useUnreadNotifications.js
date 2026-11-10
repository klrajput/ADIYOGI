import { useCallback, useEffect, useState } from 'react';
import { notifications } from '../api/endpoints';

/** Fired by any screen that changes read state, so the header bell stays true. */
export const NOTIFICATIONS_CHANGED_EVENT = 'adiyogi:notifications-changed';

export function announceNotificationsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

/**
 * Unread notification count for the header bell.
 *
 * The count always comes from the API (`meta.total` for an unreadOnly query,
 * or `meta.unreadCount` when provided). When the request fails the count is
 * `null` and the bell renders without a badge — no invented numbers.
 */
export function useUnreadNotifications({ enabled = true, pollMs = 60_000 } = {}) {
  const [count, setCount] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { meta } = await notifications.list({ unreadOnly: true, limit: 1 });
      if (typeof meta?.total === 'number') setCount(meta.total);
      else if (typeof meta?.unreadCount === 'number') setCount(meta.unreadCount);
      else setCount(null);
    } catch {
      setCount(null);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCount(null);
      return undefined;
    }
    refresh();
    const interval = window.setInterval(refresh, pollMs);
    const onFocus = () => refresh();
    const onChanged = () => refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [enabled, pollMs, refresh]);

  return { count, refresh };
}

export default useUnreadNotifications;
