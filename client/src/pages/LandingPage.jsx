import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import Badge from '../components/ui/Badge';
import BoardCard from '../components/forum/BoardCard';
import { Icon } from '../components/common/Icons';
import { boards } from '../api/endpoints';
import useApiResource from '../hooks/useApiResource';
import usePageTitle from '../hooks/usePageTitle';
import { PEER_SUPPORT_DISCLAIMER, AI_DISCLOSURE, PRIVACY_SUMMARY } from '../lib/constants';
import { asList, normalizeBoard } from '../lib/normalize';

const STEPS = [
  {
    number: '01',
    title: 'Choose a space',
    body: 'Boards are grouped by what you are carrying, not by who you are. Read for as long as you like before writing anything.',
  },
  {
    number: '02',
    title: 'Read or share, anonymously',
    body: 'Everything is posted under a server-issued alias. No real name, email, or public profile is needed to take part.',
  },
  {
    number: '03',
    title: 'Find support beyond the forum',
    body: 'Talk things through with the AI companion, or reach verified crisis lines and services at any hour.',
  },
];

const SAFETY_POINTS = [
  {
    icon: 'warning',
    title: 'Content warnings you control',
    body: 'Difficult posts are clearly marked and blurred until each reader chooses to reveal them.',
  },
  {
    icon: 'flag',
    title: 'Reporting that reaches a person',
    body: 'Reports go to a moderation team who can hide, lock, or remove content. Nobody is reading every post in real time.',
  },
  {
    icon: 'shield',
    title: 'Layered, honest moderation',
    body: 'Plain-text rules, rate limits and validated input run automatically; humans handle the judgement calls. We do not claim 24/7 AI moderation.',
  },
];

function BoardCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="skeleton h-11 w-11 rounded-lg" />
        <div className="skeleton h-5 w-24 rounded-full" />
      </div>
      <div className="skeleton mt-4 h-4 w-2/3" />
      <div className="skeleton mt-2 h-3 w-full" />
      <div className="skeleton mt-2 h-3 w-1/2" />
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="eyebrow text-ink-muted">{eyebrow}</p> : null}
        <h2 className="mt-1 font-serif text-2xl leading-tight text-ink sm:text-3xl">{title}</h2>
        {description ? <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default function LandingPage() {
  usePageTitle();

  const boardsResource = useApiResource(async () => boards.list(), []);
  const boardList = asList(boardsResource.data, ['boards'])
    .map(normalizeBoard)
    .filter((board) => board && board.slug);
  const previewBoards = boardList.slice(0, 4);

  return (
    <div>
      {/* Hero */}
      <section className="container-page pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pt-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent-600">
              <span aria-hidden="true" className="h-px w-8 bg-accent-400" />
              Anonymous · Peer support · No account needed
            </p>
            <h1 className="mt-5 break-words font-serif text-4xl leading-[1.1] text-ink sm:text-5xl lg:text-[3.4rem]">
              A quiet place to be heard, exactly as you are.
            </h1>
            <p className="mt-5 max-w-prose text-base leading-relaxed text-ink-muted sm:text-lg">
              AdiYogi is a peer-support community for mental health. Read what others are carrying, share your own
              experience under an anonymous alias, talk with an AI companion, or reach a verified crisis line — without
              handing over your identity.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button to="/community" size="lg">
                Find support
                <Icon name="arrow-right" className="h-4 w-4" />
              </Button>
              <Button to="/chat" size="lg" variant="secondary">
                Talk to the companion
              </Button>
              <Button to="/crisis" size="lg" variant="ghost" className="text-crisis-700 hover:bg-crisis-50">
                <Icon name="heart" className="h-4 w-4" />
                Get help now
              </Button>
            </div>

            <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
          </div>

          <div className="rounded-xl bg-primary-900 p-6 text-primary-50 shadow-card sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">What this is</p>
            <ul className="mt-4 space-y-3">
              {[
                'A moderated space for people who understand hard days',
                'An AI companion that is honest about being a program',
                'Verified crisis lines and services, always one click away',
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed">
                  <Icon name="check" className="mt-0.5 h-4 w-4 text-primary-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="my-6 h-px bg-primary-700" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">What this is not</p>
            <ul className="mt-4 space-y-3">
              {[
                'Not therapy, diagnosis, or a replacement for professional care',
                'Not an emergency service — no one is monitoring 24/7',
                'Not a social network: no follower counts, no popularity signals',
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-primary-100">
                  <Icon name="close" className="mt-0.5 h-4 w-4 text-primary-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/guidelines"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary-200 underline decoration-primary-400 underline-offset-4 hover:text-white"
            >
              Read the community guidelines
              <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-surface">
        <div className="container-page py-14 sm:py-16">
          <SectionHeading
            eyebrow="How it works"
            title="Three small steps, at your own pace"
            description="There is no sign-up wall between you and support. Reading is always free; writing takes one click."
          />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.number} className="card p-6">
                <span aria-hidden="true" className="font-serif text-3xl text-accent-500">
                  {step.number}
                </span>
                <h3 className="mt-3 font-serif text-xl text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Board directory preview — real data from GET /boards */}
      <section className="container-page py-14 sm:py-16" aria-label="Board directory preview">
        <SectionHeading
          eyebrow="Community"
          title="Spaces you can start in"
          description="Each board has its own guidelines, tags and pace. Counts come straight from the community database, so they are always current."
          action={
            <Button to="/community" variant="secondary">
              See all boards
            </Button>
          }
        />

        <div className="mt-8">
          {boardsResource.loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
              <span className="sr-only">Loading boards</span>
              {[0, 1, 2, 3].map((key) => (
                <BoardCardSkeleton key={key} />
              ))}
            </div>
          ) : boardsResource.error ? (
            <ErrorState
              title="Boards could not be loaded"
              description="The board directory is temporarily unavailable. You can still reach crisis support now."
              onRetry={boardsResource.refetch}
            />
          ) : previewBoards.length === 0 ? (
            <EmptyState
              icon="🌱"
              title="Boards are being prepared"
              description="No public boards are open yet. Crisis support is available in the meantime."
              action={
                <Button to="/crisis" variant="secondary">
                  Crisis support
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {previewBoards.map((board) => (
                <BoardCard key={board.slug} board={board} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Privacy and AI disclosure */}
      <section className="border-y border-line bg-surface" aria-label="Privacy and AI disclosure">
        <div className="container-page grid gap-6 py-14 sm:py-16 lg:grid-cols-2">
          <div className="card p-6 sm:p-8">
            <Badge tone="primary">
              <Icon name="shield" className="h-3 w-3" />
              Privacy
            </Badge>
            <h2 className="mt-4 font-serif text-2xl text-ink">What we store — and what we never ask for</h2>
            <ul className="mt-4 space-y-3">
              {PRIVACY_SUMMARY.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                  <Icon name="check" className="mt-0.5 h-4 w-4 text-primary-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-ink-muted">
              You can review and change what AdiYogi keeps about you, and delete everything, from{' '}
              <Link to="/preferences" className="link">
                Privacy and your data
              </Link>
              .
            </p>
          </div>

          <div className="card p-6 sm:p-8">
            <Badge tone="accent">
              <Icon name="sparkle" className="h-3 w-3" />
              AI, honestly
            </Badge>
            <h2 className="mt-4 font-serif text-2xl text-ink">The companion is a program, not a clinician</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">{AI_DISCLOSURE}</p>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              When messages suggest you may be in distress, the companion is designed to point towards crisis resources
              rather than continue as usual. Automated detection can miss things — it is a safety net, not a guarantee,
              and nobody is monitoring conversations in real time.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button to="/chat" variant="secondary" size="sm">
                See how the companion works
              </Button>
              <Button to="/resources" variant="ghost" size="sm">
                Wellbeing resources
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Safety and community */}
      <section className="container-page py-14 sm:py-16" aria-label="Safety and community">
        <SectionHeading
          eyebrow="Safety"
          title="Designed for care, not engagement"
          description="No streaks, no leaderboards, no notifications engineered to pull you back. Just the tools for a difficult moment."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SAFETY_POINTS.map((point) => (
            <div key={point.title} className="card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-paper text-primary-700">
                <Icon name={point.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-serif text-lg text-ink">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{point.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          Read the full{' '}
          <Link to="/guidelines" className="link">
            community guidelines
          </Link>{' '}
          or learn how to{' '}
          <Link to="/resources" className="link">
            look after yourself between sessions
          </Link>
          .
        </p>
      </section>

      {/* Closing CTA */}
      <section className="container-page pb-16 sm:pb-24">
        <div className="rounded-xl border border-line bg-surface px-6 py-10 text-center shadow-card sm:px-12">
          <p className="eyebrow text-ink-muted">You are welcome here</p>
          <h2 className="mx-auto mt-2 max-w-2xl font-serif text-3xl leading-tight text-ink sm:text-4xl">
            You do not have to explain yourself to deserve support.
          </h2>
          <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-ink-muted sm:text-base">
            Start by reading. Write when it feels right. Reach for crisis support the moment you need it.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button to="/community" size="lg">
              Find support
            </Button>
            <Button to="/crisis" size="lg" variant="crisis">
              Get help now
            </Button>
            <Button to="/guidelines" size="lg" variant="ghost">
              Read the guidelines
            </Button>
          </div>
          <p className="mx-auto mt-6 max-w-prose text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
        </div>
      </section>
    </div>
  );
}
