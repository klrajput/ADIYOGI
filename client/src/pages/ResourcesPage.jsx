import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import {
  WELLNESS_CATEGORIES,
  WELLNESS_DISCLAIMER,
  WELLNESS_RESOURCES,
} from '../data/wellnessResources';
import ShlokaCard from '../components/shloka/ShlokaCard';
import CategoryAtmosphere from '../components/categories/CategoryAtmosphere';
import Reveal from '../components/motion/Reveal';
import { SHLOKAS } from '../data/shlokas';

const ALL = 'all';

function categoryLabel(categoryId) {
  return WELLNESS_CATEGORIES.find((category) => category.id === categoryId)?.label || 'Wellness';
}

function ArticleLinks({ links }) {
  if (!Array.isArray(links) || links.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Official reading
      </h4>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="link text-sm"
            >
              {link.label}
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Article({ article }) {
  return (
    <article
      id={`article-${article.id}`}
      className="scroll-mt-24 rounded-lg border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{categoryLabel(article.categoryId)}</Badge>
        {article.readMinutes ? (
          <span className="text-xs text-ink-muted">{article.readMinutes} min read</span>
        ) : null}
      </div>
      <h2 className="mt-3 font-serif text-2xl text-ink">{article.title}</h2>
      {article.summary ? (
        <p className="mt-2 max-w-prose text-base leading-relaxed text-ink-soft">{article.summary}</p>
      ) : null}

      <div className="mt-4 space-y-4">
        {article.sections.map((section) => (
          <section key={section.heading}>
            <h3 className="font-serif text-lg text-ink">{section.heading}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      {Array.isArray(article.takeaways) && article.takeaways.length > 0 ? (
        <div className="mt-5 rounded-lg border border-primary-200 bg-primary-50 p-4">
          <h4 className="text-sm font-semibold text-primary-800">What to remember</h4>
          <ul className="mt-2 space-y-1.5">
            {article.takeaways.map((takeaway) => (
              <li key={takeaway} className="flex gap-2 text-sm text-primary-900">
                <span aria-hidden="true" className="text-primary-600">
                  ✓
                </span>
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ArticleLinks links={article.links} />
    </article>
  );
}

export default function ResourcesPage() {
  const [activeCategory, setActiveCategory] = useState(ALL);

  const visibleArticles = useMemo(
    () =>
      activeCategory === ALL
        ? WELLNESS_RESOURCES
        : WELLNESS_RESOURCES.filter((article) => article.categoryId === activeCategory),
    [activeCategory]
  );

  const counts = useMemo(() => {
    const result = new Map();
    WELLNESS_RESOURCES.forEach((article) => {
      result.set(article.categoryId, (result.get(article.categoryId) || 0) + 1);
    });
    return result;
  }, []);

  return (
    <div id="library-top" className="container-page py-6 sm:py-10">
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-line bg-surface px-6 py-8 shadow-card sm:px-8">
        <div aria-hidden="true" className="absolute inset-0">
          <CategoryAtmosphere atmosphere="nature" />
        </div>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-surface/95 via-surface/85 to-surface/30" />
        <div className="relative max-w-prose">
          <p className="eyebrow-divine">Wellness library</p>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
            Things that help, explained honestly
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            Plain-language education about anxiety, low mood, sleep, grounding and supporting other
            people. Written to be accurate and calm — not to diagnose anyone. Everything here is
            general information, and none of it replaces a conversation with a professional.
          </p>
        </div>
      </header>

      {/* Persistent help CTA */}
      <div className="sticky top-16 z-20 mt-5">
        <div className="flex flex-col gap-2 rounded-lg border border-crisis-200 bg-crisis-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-crisis-800">
            <span className="font-semibold">If you need help now,</span> reading is not a substitute
            for a person. Verified helplines are one tap away.
          </p>
          <Link to="/crisis" className="btn-crisis min-h-[44px] shrink-0">
            Get help now
          </Link>
        </div>
      </div>

      <section id="wisdom" aria-labelledby="resources-wisdom-title" className="mt-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow-divine">Wisdom for reflection</p>
            <h2 id="resources-wisdom-title" className="mt-2 font-serif text-2xl text-ink">
              Verses to sit with
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
              Two short passages people often return to. Reflection can steady a difficult moment —
              it is not treatment and does not replace professional care.
            </p>
          </div>
          <Link to="/crisis" className="link shrink-0 text-sm">
            Need help now?
          </Link>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {SHLOKAS.slice(0, 2).map((shloka, index) => (
            <Reveal key={shloka.id} delay={index * 80}>
              <ShlokaCard shloka={shloka} compact showTransliteration={false} />
            </Reveal>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <nav aria-labelledby="library-filters-title" className="card p-4">
            <h2 id="library-filters-title" className="text-sm font-semibold text-ink">
              Filter by topic
            </h2>
            <ul className="mt-3 space-y-1">
              <li>
                <button
                  type="button"
                  aria-pressed={activeCategory === ALL}
                  onClick={() => setActiveCategory(ALL)}
                  className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    activeCategory === ALL
                      ? 'bg-primary-700 font-semibold text-white'
                      : 'text-ink-soft hover:bg-paper'
                  }`}
                >
                  <span>All topics</span>
                  <span className={activeCategory === ALL ? 'text-white' : 'text-ink-muted'}>
                    {WELLNESS_RESOURCES.length}
                  </span>
                </button>
              </li>
              {WELLNESS_CATEGORIES.map((category) => {
                const pressed = activeCategory === category.id;
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => setActiveCategory(category.id)}
                      className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        pressed
                          ? 'bg-primary-700 font-semibold text-white'
                          : 'text-ink-soft hover:bg-paper'
                      }`}
                    >
                      <span>{category.label}</span>
                      <span className={pressed ? 'text-white' : 'text-ink-muted'}>
                        {counts.get(category.id) || 0}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-line pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                In this section
              </h3>
              <ul className="mt-2 space-y-1.5">
                {visibleArticles.map((article) => (
                  <li key={article.id}>
                    <a href={`#article-${article.id}`} className="link text-sm">
                      {article.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="mt-4 rounded-lg border border-line bg-paper p-4">
            <h2 className="font-serif text-base text-ink">When to seek professional help</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              If symptoms last more than two weeks, get worse, or affect sleep, work or
              relationships, talk to a doctor or mental-health professional. If you are in immediate
              danger, contact emergency services.
            </p>
            <a href="#article-when-to-seek-help" className="link mt-2 inline-block text-sm">
              Read the full guidance →
            </a>
          </div>
        </aside>

        <div role="region" aria-label="Wellness articles">
          <p className="text-sm text-ink-muted" role="status" aria-live="polite">
            Showing {visibleArticles.length}{' '}
            {visibleArticles.length === 1 ? 'article' : 'articles'}
            {activeCategory === ALL ? '' : ` in ${categoryLabel(activeCategory)}`}.
          </p>

          <div className="mt-4 space-y-6">
            {visibleArticles.map((article) => (
              <Article key={article.id} article={article} />
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-accent-200 bg-accent-50 p-5">
            <h2 className="font-serif text-lg text-accent-800">A note on this library</h2>
            <p className="mt-2 text-sm leading-relaxed text-accent-800">{WELLNESS_DISCLAIMER}</p>
            <p className="mt-2 text-sm leading-relaxed text-accent-800">
              AdiYogi also has an AI companion and peer community. Neither is a clinician, neither
              can diagnose you, and neither monitors you for emergencies. For support from a person,
              use the{' '}
              <Link to="/crisis" className="font-semibold underline decoration-accent-400 underline-offset-2">
                crisis resources
              </Link>
              .
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <a href="#library-top" className="link text-sm">
              ↑ Back to the top of the library
            </a>
            <Link to="/crisis" className="btn-crisis min-h-[44px]">
              Get help now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
