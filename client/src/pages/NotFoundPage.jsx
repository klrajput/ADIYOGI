import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import PageHeader from '../components/common/PageHeader';
import { Icon } from '../components/common/Icons';
import usePageTitle from '../hooks/usePageTitle';
import { PEER_SUPPORT_DISCLAIMER } from '../lib/constants';

const LINKS = [
  {
    to: '/community',
    icon: 'community',
    title: 'Browse the community',
    body: 'Find a board and read what others are carrying.',
  },
  {
    to: '/',
    icon: 'home',
    title: 'Go back home',
    body: 'Start again from the beginning.',
  },
  {
    to: '/guidelines',
    icon: 'shield',
    title: 'Community guidelines',
    body: 'What is expected here, and how moderation works.',
  },
];

/**
 * Calm 404. It never guesses, never blames the reader, and always leaves a route
 * to support.
 */
export default function NotFoundPage() {
  usePageTitle('Page not found');

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="404"
          title="This page is not here"
          description="The link may be old, mistyped, or the page may have been removed. Nothing has gone wrong with your session or your posts."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="card-interactive group flex flex-col p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-paper text-primary-700">
                <Icon name={link.icon} className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-serif text-lg text-ink group-hover:text-primary-800">{link.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{link.body}</p>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-crisis-200 bg-crisis-50 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-serif text-lg text-crisis-700">
            <Icon name="heart" className="h-5 w-5" />
            If you came here looking for help
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-crisis-700/90">
            You do not need to find the right page first. Verified crisis lines, text services, and an international
            directory are one click away.
          </p>
          <Button to="/crisis" variant="crisis" className="mt-4">
            Open crisis support
          </Button>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
      </div>
    </div>
  );
}
