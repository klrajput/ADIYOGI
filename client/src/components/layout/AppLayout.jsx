import { Outlet } from 'react-router-dom';

/**
 * Application shell: skip link, header, main landmark, footer.
 * OWNER: Frontend A — replace this scaffold with the real navigation, crisis bar,
 * mobile drawer and footer (keep the <Outlet /> and landmark structure).
 */
export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="border-b border-line bg-surface">
        <div className="container-page flex h-16 items-center justify-between">
          <a href="/" className="font-serif text-lg font-semibold text-primary-800">
            AdiYogi
          </a>
          <nav aria-label="Primary" className="text-sm text-ink-muted">
            App shell scaffold
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="container-page py-6 text-xs text-ink-faint">
          AdiYogi provides peer support and is not a substitute for professional care.
        </div>
      </footer>
    </div>
  );
}
