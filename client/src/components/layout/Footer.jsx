import { Link } from 'react-router-dom';
import Logo from '../common/Logo';
import { Icon } from '../common/Icons';
import { PEER_SUPPORT_DISCLAIMER } from '../../lib/constants';

const COLUMNS = [
  {
    title: 'Community',
    links: [
      { to: '/community', label: 'All spaces' },
      { to: '/boards/support', label: 'General support' },
      { to: '/boards/anxiety', label: 'Anxiety & panic' },
      { to: '/boards/depression', label: 'Low mood' },
      { to: '/boards/success', label: 'Success stories' },
    ],
  },
  {
    title: 'Care & wisdom',
    links: [
      { to: '/resources', label: 'Wellness library' },
      { to: '/crisis', label: 'Meditation & breath' },
      { to: '/#wisdom', label: 'Sanskrit wisdom' },
      { to: '/chat', label: 'AI companion' },
      { to: '/guidelines', label: 'Community guidelines' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/crisis', label: 'Crisis help now' },
      { to: '/preferences', label: 'Privacy & preferences' },
      { to: '/notifications', label: 'Notifications' },
      { to: '/login', label: 'Sign in' },
    ],
  },
];

/**
 * Cosmic footer: the calm close of the page. Keeps the crisis affordance, the
 * peer-support disclaimer and honest platform statements (no fake metrics).
 */
export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-cosmic-rise text-paper">
      <div aria-hidden="true" className="cosmic-stars opacity-60" />
      <div aria-hidden="true" className="absolute -right-16 -top-24 select-none font-serif text-[16rem] leading-none text-accent-200/[0.06]">
        ॐ
      </div>
      <div className="rule-gold" />

      <div className="container-page relative z-10 py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/70">
              A quiet digital sanctuary for mental wellness, inspired by the timeless wisdom of India.
              Read, share and breathe — anonymously.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-paper/20 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-paper/65">
                Anonymous by design
              </span>
              <span className="rounded-full border border-paper/20 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-paper/65">
                Peer support
              </span>
              <span className="rounded-full border border-accent-200/40 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-accent-200">
                No ads, no data selling
              </span>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="font-serif text-sm uppercase tracking-[0.18em] text-accent-200">{column.title}</h2>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.to + link.label}>
                      <Link to={link.to} className="text-sm text-paper/70 transition-colors hover:text-surface">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 rounded-2xl border border-accent-200/20 bg-cosmic-deep/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-paper/75">
            <Icon name="heart" className="mt-0.5 h-4 w-4 shrink-0 text-accent-200" />
            If you are in immediate danger, contact your local emergency number. Verified crisis lines for
            your region are always available on the crisis page.
          </p>
          <Link
            to="/crisis"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent-200/50 px-4 py-2 text-sm font-medium text-accent-200 transition-colors hover:bg-accent-200/10"
          >
            Get help now
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-paper/10 pt-6 text-xs leading-relaxed text-paper/50 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl">{PEER_SUPPORT_DISCLAIMER}</p>
          <p className="shrink-0">© {new Date().getFullYear()} AdiYogi · Built with care in India</p>
        </div>
      </div>
    </footer>
  );
}
