import { useEffect } from 'react';
import { APP_NAME } from '../lib/constants';

const BASE_TITLE = `${APP_NAME} — anonymous peer support for mental health`;

/** Sets a per-page document title (route changes in an SPA are not announced). */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}

export default usePageTitle;
