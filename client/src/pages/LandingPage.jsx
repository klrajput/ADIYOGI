import { useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { LoadingBlock } from '../components/ui/Spinner';
import { Icon } from '../components/common/Icons';
import BoardCard from '../components/forum/BoardCard';
import DiscussionCard from '../components/forum/DiscussionCard';
import CategoryCard from '../components/categories/CategoryCard';
import CategoryAtmosphere from '../components/categories/CategoryAtmosphere';
import ShlokaCard from '../components/shloka/ShlokaCard';
import CosmicBackdrop from '../components/motion/CosmicBackdrop';
import AuraField from '../components/motion/AuraField';
import Reveal from '../components/motion/Reveal';
import Parallax from '../components/motion/Parallax';
import SectionHeading from '../components/motion/SectionHeading';
import ShivaMeditation from '../components/deities/ShivaMeditation';
import RamaIllustration from '../components/deities/RamaIllustration';
import VishnuIllustration from '../components/deities/VishnuIllustration';
import { boards, threads } from '../api/endpoints';
import useApiResource from '../hooks/useApiResource';
import usePageTitle from '../hooks/usePageTitle';
import { AI_DISCLOSURE, PEER_SUPPORT_DISCLAIMER } from '../lib/constants';
import { asList, normalizeBoard, normalizeThread } from '../lib/normalize';
import { WELLNESS_CATEGORIES } from '../data/wellnessCategories';
import { SHLOKAS, SHLOKA_BY_ID, shlokaOfTheDay } from '../data/shlokas';

const JOURNEY = [
  {
    step: '01',
    title: 'Arrive without a name',
    body: 'No email, no profile, no real name. A quiet alias is issued for you, and you can read for as long as you need before writing anything.',
  },
  {
    step: '02',
    title: 'Name what you carry',
    body: 'Choose a wellness space, then read or share. Content warnings keep difficult posts folded until each reader chooses to open them.',
  },
  {
    step: '03',
    title: 'Take one steady step',
    body: 'A breathing pause, a verse to sit with, one honest reply from someone who understands — small, real supports that fit inside a difficult day.',
  },
];

const BENEFITS = [
  {
    icon: 'shield',
    title: 'Anonymous by design',
    body: 'No real name or email to read, post, or talk to the companion. Only a one-way hash of your IP is kept for abuse prevention.',
  },
  {
    icon: 'flag',
    title: 'Moderated, not monitored',
    body: 'Reports reach a human moderator who can hide, lock or remove content. We do not claim to watch every conversation in real time.',
  },
  {
    icon: 'sparkle',
    title: 'Honest about AI',
    body: 'The companion is a program, not a clinician. If it is unavailable you get a clear message and real resources — never invented comfort.',
  },
  {
    icon: 'heart',
    title: 'Help that stays visible',
    body: 'Verified crisis lines for your region are one click away at all times, whether or not anything was detected.',
  },
];

function TrustChip({ icon, label }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-paper/15 bg-surface/[0.06] px-3.5 py-1.5 text-xs text-paper/80 backdrop-blur">
      <Icon name={icon} className="h-3.5 w-3.5 text-accent-200" />
      {label}
    </span>
  );
}

function BreathingOrb() {
  return (
    <div className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72" aria-hidden="true">
      <div className="absolute h-full w-full animate-breathe rounded-full border border-accent-200/25" />
      <div className="absolute h-4/5 w-4/5 animate-breathe rounded-full border border-accent-200/35 [animation-delay:0.8s]" />
      <div className="absolute h-3/5 w-3/5 animate-breathe rounded-full bg-[radial-gradient(circle,rgba(234,211,162,0.35),transparent_70%)] [animation-delay:1.6s]" />
      <div className="relative text-center">
        <p className="font-deva text-2xl text-accent-200">श्वास</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-paper/60">breathe</p>
      </div>
    </div>
  );
}

function ShlokaWheel() {
  const trackRef = useRef(null);
  const scrollByCard = useCallback((direction) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('[data-shloka]');
    const amount = card ? card.getBoundingClientRect().width + 20 : 340;
    track.scrollBy({ left: amount * direction, behavior: 'smooth' });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-paper/25 text-paper/75 transition-colors hover:bg-surface/10 hover:text-surface"
          aria-label="Previous verse"
        >
          <Icon name="arrow-left" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-paper/25 text-paper/75 transition-colors hover:bg-surface/10 hover:text-surface"
          aria-label="Next verse"
        >
          <Icon name="arrow-right" className="h-4 w-4" />
        </button>
      </div>
      <ul
        ref={trackRef}
        className="no-scrollbar mt-5 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3"
        aria-label="Verses for reflection"
      >
        {SHLOKAS.map((shloka) => (
          <li key={shloka.id} data-shloka className="w-[min(88vw,24rem)] shrink-0 snap-start">
            <ShlokaCard
              shloka={shloka}
              tone="cosmic"
              compact
              className="h-full"
              note="Ancient wisdom for reflection — never a substitute for professional care."
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LandingPage() {
  usePageTitle('AdiYogi — a quiet sanctuary for mental wellness');

  const directory = useApiResource(
    () => Promise.all([boards.list(), threads.list({ sort: 'recent', limit: 6 })]),
    []
  );

  const [boardList, threadList] = useMemo(() => {
    const [boardsResult, threadsResult] = Array.isArray(directory.data) ? directory.data : [];
    const boardItems = asList(boardsResult?.data, ['boards']).map(normalizeBoard).filter(Boolean);
    const threadItems = asList(threadsResult?.data, ['threads']).map(normalizeThread).filter(Boolean);
    return [boardItems, threadItems];
  }, [directory.data]);

  const dailyShloka = shlokaOfTheDay();
  const courageShloka = SHLOKA_BY_ID['action-not-fruit'];
  const balanceShloka = SHLOKA_BY_ID['self-uplift'];

  return (
    <div className="overflow-x-clip">
      {/* ================= HERO ================= */}
      <section className="relative isolate overflow-hidden bg-cosmic-rise" aria-labelledby="hero-title">
        <CosmicBackdrop variant="deep" />
        <div className="container-page relative z-10 grid items-center gap-12 pb-20 pt-14 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:pb-28 lg:pt-20">
          <div className="max-w-xl">
            <Reveal>
              <p className="eyebrow-divine !text-accent-200">A digital sanctuary · since the first yogi</p>
            </Reveal>
            <Reveal delay={90}>
              <h1 id="hero-title" className="mt-5 font-serif text-[2.6rem] leading-[1.06] text-surface sm:text-6xl lg:text-[4.15rem]">
                Find stillness within.
                <span className="mt-2 block text-gold-gradient">Discover strength beyond.</span>
              </h1>
            </Reveal>
            <Reveal delay={170}>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-paper/75 sm:text-lg">
                A peaceful space to understand your mind, reconnect with yourself, and begin your journey
                towards emotional wellness — inspired by the timeless wisdom of India.
              </p>
            </Reveal>
            <Reveal delay={250}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button to="/community" variant="accent" size="lg" className="btn-gold">
                  Begin your journey
                </Button>
                <Button to="/resources" variant="secondary" size="lg" className="btn-outline-divine">
                  Explore inner peace
                </Button>
              </div>
            </Reveal>
            <Reveal delay={330}>
              <div className="mt-8 flex flex-wrap gap-2">
                <TrustChip icon="shield" label="Anonymous by design" />
                <TrustChip icon="community" label="Peer support, not clinical care" />
                <TrustChip icon="heart" label="Crisis help always visible" />
              </div>
            </Reveal>
            <Reveal delay={400}>
              <p className="mt-8 max-w-md border-l border-accent-200/30 pl-4 text-sm leading-relaxed text-paper/60">
                {PEER_SUPPORT_DISCLAIMER}{' '}
                <Link to="/crisis" className="font-medium text-accent-200 underline underline-offset-2 hover:text-accent-100">
                  Get help now
                </Link>
                .
              </p>
            </Reveal>
          </div>

          <div className="relative">
            <Parallax strength={0.05}>
              <div className="relative mx-auto w-full max-w-[30rem]">
                <AuraField tone="gold" />
                <ShivaMeditation
                  className="relative z-10 mx-auto w-full drop-shadow-[0_24px_60px_rgba(8,20,32,0.55)]"
                  title="An original illustration of Adiyogi, the first yogi, seated in meditation"
                />
                <div className="glass-dark absolute -left-2 bottom-6 z-20 hidden max-w-[13.5rem] rounded-2xl p-4 sm:block">
                  <p className="font-deva text-lg leading-relaxed text-accent-200" lang="sa">
                    योगस्थः कुरु कर्माणि
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-paper/55">
                    Established in yoga, act
                  </p>
                </div>
                <div className="glass-dark absolute -right-1 top-10 z-20 hidden rounded-full px-4 py-2 sm:flex sm:items-center sm:gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-300" aria-hidden="true" />
                  <span className="text-[11px] uppercase tracking-[0.16em] text-paper/70">Adiyogi · the first yogi</span>
                </div>
              </div>
            </Parallax>
          </div>
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper to-transparent" />
      </section>

      {/* ================= DAILY WISDOM ================= */}
      <section id="wisdom" className="relative section-pad bg-paper">
        <div className="container-narrow">
          <SectionHeading
            align="center"
            eyebrow="Daily wisdom"
            title="Ancient words for a modern mind"
            description="One verse a day, offered as a moment of reflection. Not a treatment, a prescription, or a diagnosis."
          />
          <Reveal className="mt-10" delay={80}>
            <ShlokaCard
              shloka={dailyShloka}
              note="Wisdom for reflection only. If you are struggling, please also reach out to people and professionals who can support you."
            />
          </Reveal>
        </div>
      </section>

      {/* ================= WELLNESS CATEGORIES ================= */}
      <section className="relative section-pad bg-surface" aria-labelledby="categories-title">
        <div className="container-page">
          <SectionHeading
            id="categories-title"
            titleId="categories-title"
            eyebrow="Mental wellness spaces"
            title="Where would you like to begin?"
            description="Eight spaces, each with its own atmosphere and community. Start wherever you are today — no labels, no diagnosis."
            action={
              <Button to="/community" variant="secondary">
                All spaces
              </Button>
            }
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WELLNESS_CATEGORIES.map((category, index) => (
              <Reveal key={category.slug} delay={index * 60} className="h-full">
                <CategoryCard category={category} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= JOURNEY ================= */}
      <section className="relative section-pad bg-sage-mist" aria-labelledby="journey-title">
        <div className="container-page">
          <SectionHeading
            titleId="journey-title"
            eyebrow="Your journey"
            title="Three quiet steps, at your own pace"
            description="No streak counters, no gamification. Just a calm path into support."
            align="center"
          />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {JOURNEY.map((item, index) => (
              <Reveal as="li" key={item.step} delay={index * 90} className="relative">
                <div className="card-divine h-full p-6">
                  <span className="font-serif text-4xl text-accent-300" aria-hidden="true">
                    {item.step}
                  </span>
                  <h3 className="mt-3 font-serif text-xl text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= MEDITATION ================= */}
      <section className="relative overflow-hidden bg-cosmic-soft" aria-labelledby="meditation-title">
        <div aria-hidden="true" className="cosmic-stars opacity-70" />
        <div className="container-page relative z-10 grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:py-24">
          <Reveal>
            <p className="eyebrow-divine !text-accent-200">Meditation & mindfulness</p>
            <h2 id="meditation-title" className="section-heading-light mt-3">
              You can begin in sixty seconds
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-paper/70">
              You do not need an empty mind, a cushion, or an hour. A slower exhale is a real beginning.
              Our guided breathing counts with you, and the wellness library holds grounding practices you
              can return to on hard afternoons.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-paper/75">
              {['Breathe in for four, hold for four, release for six.', 'Ground through five senses, one at a time.', 'Close the day with one thing that went quietly right.'].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-300" />
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/crisis" variant="accent" className="btn-gold">
                Start a guided breath
              </Button>
              <Button to="/resources" variant="secondary" className="btn-outline-divine">
                Wellness library
              </Button>
            </div>
          </Reveal>
          <Reveal delay={140} className="relative">
            <BreathingOrb />
            <p className="mt-2 text-center text-xs uppercase tracking-[0.2em] text-paper/45">
              follow the rhythm, not the pressure
            </p>
          </Reveal>
        </div>
      </section>

      {/* ================= COURAGE — RAMA ================= */}
      <section className="relative section-pad bg-surface" aria-labelledby="courage-title">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="relative order-2 lg:order-1">
            <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-accent-50 to-paper p-4">
              <CategoryAtmosphere atmosphere="nature" animated />
              <RamaIllustration
                className="relative z-10 mx-auto w-full"
                title="An original illustration of Lord Rama holding a bow and arrow in a sunlit forest"
              />
            </div>
          </Reveal>
          <Reveal delay={120} className="order-1 lg:order-2">
            <p className="eyebrow-divine">Courage · discipline</p>
            <h2 id="courage-title" className="section-heading mt-3">
              Steady action, steady heart
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              Rama's story is one of patient, repeated choosing — of dharma over urgency, of care over
              impulse. On days when the next step feels heavy, the invitation is not to feel fearless, but to
              act with a steady heart.
            </p>
            {courageShloka ? (
              <div className="mt-6">
                <ShlokaCard shloka={courageShloka} compact showTransliteration={false} />
              </div>
            ) : null}
            <div className="mt-6">
              <Button to="/boards/support" variant="primary">
                Share what is heavy
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= BALANCE — VISHNU ================= */}
      <section className="relative section-pad bg-paper" aria-labelledby="balance-title">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow-divine">Balance · preservation</p>
            <h2 id="balance-title" className="section-heading mt-3">
              Preserve what matters
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              Vishnu holds the world steady rather than remaking it. Recovery works the same way: not a
              dramatic overhaul, but protecting sleep, food, connection and one small practice long enough
              for the nervous system to trust you again.
            </p>
            {balanceShloka ? (
              <div className="mt-6">
                <ShlokaCard shloka={balanceShloka} compact showTransliteration={false} />
              </div>
            ) : null}
            <div className="mt-6">
              <Button to="/boards/resources" variant="secondary">
                Tools that hold steady
              </Button>
            </div>
          </Reveal>
          <Reveal delay={120} className="relative">
            <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-support-900 to-cosmic-deep p-4">
              <VishnuIllustration
                className="relative z-10 mx-auto w-full"
                title="An original illustration of Lord Vishnu with conch, discus, mace and lotus above a cosmic ocean"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= COMMUNITY ================= */}
      <section className="relative section-pad bg-surface" aria-labelledby="community-preview-title">
        <div className="container-page">
          <SectionHeading
            titleId="community-preview-title"
            eyebrow="Community"
            title="Conversations happening now"
            description="Real people, anonymous aliases, moderated spaces. Nothing here is invented — this is live data from the forum."
            action={
              <Button to="/community" variant="secondary">
                Open community
              </Button>
            }
          />

          <div className="mt-10">
            {directory.loading ? <LoadingBlock label="Loading community conversations" rows={3} /> : null}

            {directory.error ? (
              <ErrorState
                title="Community could not be loaded"
                description="We could not reach the forum just now. Your other spaces are still available while we retry."
                onRetry={directory.refetch}
                requestId={directory.error?.requestId}
              />
            ) : null}

            {!directory.loading && !directory.error ? (
              threadList.length > 0 ? (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {threadList.slice(0, 6).map((thread, index) => (
                    <Reveal key={thread.id} delay={index * 50} className="h-full">
                      <DiscussionCard thread={thread} />
                    </Reveal>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="🪷"
                  title="The first conversation is waiting"
                  description="No threads have been shared yet. You could be the first to open one — anonymously, in a space that fits."
                  action={<Button to="/boards/support">Start the first conversation</Button>}
                />
              )
            ) : null}
          </div>

          <div className="mt-16">
            <SectionHeading
              eyebrow="Spaces"
              title="Choose the space that fits today"
              description="Each space has its own guidelines and atmosphere. Read for as long as you like before posting."
            />
            {!directory.loading && !directory.error && boardList.length > 0 ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {boardList.slice(0, 8).map((board, index) => (
                  <Reveal key={board.id} delay={index * 50} className="h-full">
                    <BoardCard board={board} />
                  </Reveal>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ================= SPIRITUAL INSPIRATION ================= */}
      <section className="relative overflow-hidden bg-cosmic-rise" aria-labelledby="inspiration-title">
        <div aria-hidden="true" className="cosmic-stars opacity-70" />
        <div aria-hidden="true" className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
        <div className="container-page relative z-10 py-16 sm:py-20">
          <SectionHeading
            light
            titleId="inspiration-title"
            eyebrow="Spiritual inspiration"
            title="Wisdom to sit with"
            description="Five verses from the Bhagavad Gita, paired with the wellness space they speak to. Swipe or use the arrows."
          />
          <ShlokaWheel />
        </div>
      </section>

      {/* ================= BENEFITS ================= */}
      <section className="relative section-pad bg-paper" aria-labelledby="benefits-title">
        <div className="container-page">
          <SectionHeading
            titleId="benefits-title"
            align="center"
            eyebrow="Why AdiYogi"
            title="Calm technology, honest boundaries"
            description="Built so that a difficult day is met with privacy, clarity and real human support — never dark patterns."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit, index) => (
              <Reveal key={benefit.title} delay={index * 70} className="h-full">
                <div className="card-divine h-full p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent-200 bg-accent-50 text-accent-600">
                    <Icon name={benefit.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-serif text-lg text-ink">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{benefit.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-10">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <p className="flex items-start gap-3 text-sm leading-relaxed text-ink-muted">
                <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                <span>
                  <strong className="font-semibold text-ink">About the AI companion. </strong>
                  {AI_DISCLOSURE}
                </span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden bg-paper pb-20">
        <div className="container-page">
          <Reveal>
            <div className="cosmic-panel px-6 py-14 text-center sm:px-12 sm:py-16">
              <div aria-hidden="true" className="cosmic-stars opacity-60" />
              <div className="relative z-10 mx-auto max-w-2xl">
                <p className="eyebrow-divine !text-accent-200">Begin wherever you are</p>
                <h2 className="mt-3 font-serif text-3xl leading-tight text-surface sm:text-4xl">
                  You do not have to carry this alone.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-paper/70">
                  Read quietly, share anonymously, or simply breathe with us for a minute. The community and
                  the companion are here whenever you are ready.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button to="/community" variant="accent" size="lg" className="btn-gold">
                    Begin your journey
                  </Button>
                  <Button to="/crisis" variant="secondary" size="lg" className="btn-outline-divine">
                    Get help now
                  </Button>
                </div>
                <p className="mt-6 text-xs text-paper/45">{PEER_SUPPORT_DISCLAIMER}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
