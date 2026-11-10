import { Link } from 'react-router-dom';
import Logo from '../common/Logo';
import { Icon } from '../common/Icons';
import { PEER_SUPPORT_DISCLAIMER } from '../../lib/constants';

const COLUMNS = [
  {
    title: 'Community',
    links: [
      { to: '/community', label: 'Browse boards' },
      { to: '/community', label: 'Recent conversations' },
      { to: '/guidelines', label: 'Community guidelines' },
      { to: '/notifications', label: 'Your notifications' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/crisis', label: 'Crisis support' },
      { to: '/resources', label: 'Wellbeing resources' },
      { to: '/chat', label: 'AI companion' },
      { to: '/guidelines', label: 'How posting works' },
    ],
  },
  {
    title: 'About',
    links: [
      { to: '/preferences', label: 'Privacy and your data' },
      { to: '/preferences', label: 'Preferences' },
      { to: '/login', label: 'Sign in' },
      { to: '/guidelines', label: 'Moderation approach' },
    ],
  },
];

/**
 * Footer: three real link columns, the peer-support disclaimer and a compact,
 * always-visible crisis block. No social links, no dead anchors.
 */
export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              A quiet, anonymous place to be heard — peer support, a careful AI companion, and verified crisis
              resources, without giving up your identity.
            </p>
            <p className="mt-4 text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">{column.title}</h2>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={`${link.to}-${link.label}`}>
                    <Link to={link.to} className="text-sm text-ink-muted transition-colors hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 grid gap-6 rounded-lg border border-crisis-200 bg-crisis-50 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-lg text-crisis-700">
              <Icon name="heart" className="h-5 w-5" />
              If you need help right now
            </h2>
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-crisis-700/90">
              AdiYogi cannot monitor this site in real time and cannot respond to an emergency. Please use verified
              crisis lines, text services, or your local emergency number.
            </p>
          </div>
          <Link
            to="/crisis"
            className="btn-crisis justify-self-start px-5 py-2.5"
          >
            Get help now
            <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} AdiYogi. Peer support, not professional care.</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/guidelines" className="hover:text-ink">
              Guidelines
            </Link>
            <Link to="/preferences" className="hover:text-ink">
              Your data
            </Link>
            <Link to="/crisis" className="hover:text-ink">
              Crisis support
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
