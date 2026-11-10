import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { crisis } from '../api/endpoints';
import { useToast } from '../context/ToastContext';
import useApiResource from '../hooks/useApiResource';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';
import ErrorState from '../components/ui/ErrorState';
import { LoadingBlock } from '../components/ui/Spinner';
import BreathingExercise from '../components/crisis/BreathingExercise';
import CrisisResourceCard from '../components/crisis/CrisisResourceCard';
import {
  FIND_A_HELPLINE,
  contactHref,
  normaliseCrisisResources,
  safeHttpUrl,
} from '../components/crisis/resources';
import {
  getSavedRegion,
  REGION_OPTIONS,
  saveRegion,
  toApiCountry,
} from '../components/crisis/regionStorage';

const GROUNDING_STEPS = [
  { count: 5, label: 'things you can see', detail: 'Name them slowly and describe each one.' },
  { count: 4, label: 'things you can touch', detail: 'The chair, your sleeves, the floor under your feet.' },
  { count: 3, label: 'things you can hear', detail: 'Traffic, a fan, your own breathing.' },
  { count: 2, label: 'things you can smell', detail: 'Or two smells you remember and like.' },
  { count: 1, label: 'thing you can taste', detail: 'Take a sip of water if you can.' },
];

const COLD_WATER_STEPS = [
  'Hold something cold — an ice cube, a cold can, a chilled cloth — in your hands for a minute.',
  'Splash cool water on your face, or press a cold, damp cloth to your forehead and cheeks.',
  'Step outside or open a window for a minute of cooler air.',
  'Breathe out slowly while you do it, rather than holding your breath.',
];

const REACH_OUT_ITEMS = [
  'Text or call one person you trust, even if it is just "I am having a hard time".',
  'Move to a place where someone else is nearby — a shop, a shared room, a public space.',
  'Put anything you could use to hurt yourself out of reach, or ask someone to hold it.',
  'Contact one of the helplines on this page and let them talk you through the next hour.',
  'Decide on one small next step (water, food, a shower, sleep) and do only that.',
];

const WARNING_SIGNS = [
  'Talking about wanting to die or to hurt themselves, or looking for a way to do it.',
  'Expressing hopelessness, feeling trapped, or saying they are a burden to others.',
  'Withdrawing from friends, family and activities they usually care about.',
  'Extreme mood swings, sudden calm after a long low period, or unusual agitation.',
  'Increasing use of alcohol or drugs, or reckless behaviour.',
  'Giving away possessions, saying goodbye, or putting affairs in order.',
];

const HOW_TO_HELP = [
  'Take them seriously and stay calm — do not dismiss or debate what they are feeling.',
  'Listen without judgement. Ask directly: "are you thinking about suicide?"',
  'Do not leave them alone if they are in immediate danger, and call emergency services.',
  'Help them call a crisis line, or make the call together if that is easier for them.',
  'If it is safe and practical, put distance between them and anything they could use to hurt themselves.',
  'Stay in contact afterwards. Follow up the next day — connection matters.',
];

const ACTION_STYLES = {
  primary: 'bg-crisis-500 text-white hover:bg-crisis-600',
  secondary: 'border border-crisis-300 bg-surface text-crisis-700 hover:bg-crisis-50',
  emergency: 'border border-crisis-400 bg-crisis-100 text-crisis-800 hover:bg-crisis-200',
};

const ACTION_VERBS = { phone: 'Call', text: 'Text', chat: 'Open', web: 'Open' };

function ResourceActionLink({ resource, tone = 'primary' }) {
  const href = contactHref(resource);
  if (!href) return null;
  const isExternal = /^https?:/i.test(href);
  return (
    <a
      href={href}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold ${
        ACTION_STYLES[tone] || ACTION_STYLES.primary
      }`}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {ACTION_VERBS[resource.type] || 'Open'} {resource.name}
      {isExternal ? <span className="sr-only">(opens in a new tab)</span> : null}
    </a>
  );
}

export default function CrisisPage() {
  const { toast } = useToast();
  const [country, setCountry] = useState(() => getSavedRegion());
  const [recordState, setRecordState] = useState('idle');
  const [checkedReachOut, setCheckedReachOut] = useState(() => REACH_OUT_ITEMS.map(() => false));

  const fetchResources = useCallback(() => {
    const apiCountry = toApiCountry(country);
    return crisis.resources(apiCountry ? { country: apiCountry } : undefined);
  }, [country]);

  const { data, loading, error, refetch } = useApiResource(fetchResources, [country]);

  const resources = normaliseCrisisResources(data);
  const inferredRegion =
    resources?.region && REGION_OPTIONS.some((option) => option.code === resources.region)
      ? resources.region
      : resources
        ? 'INTL'
        : '';
  const selectedRegion = country || inferredRegion;
  const primary = resources?.primary || null;
  const textLine = resources?.text || null;
  const emergency = resources?.emergency || null;
  const local = resources?.local || [];
  const regionName = REGION_OPTIONS.find((option) => option.code === resources?.region)?.label;
  const serverDisclaimer = resources?.disclaimer || '';
  const international = resources?.international || FIND_A_HELPLINE;
  const internationalUrl = safeHttpUrl(international.url) || FIND_A_HELPLINE.url;
  const showFallbackHelp = Boolean(error) && !resources;

  const handleRegionChange = (event) => {
    const next = event.target.value;
    if (!next) return;
    setCountry(next);
    saveRegion(next);
  };

  const handleRecordRequest = async () => {
    if (recordState === 'saving' || recordState === 'recorded') return;
    setRecordState('saving');
    try {
      await crisis.recordEvent({
        level: 'high',
        source: 'manual',
        country: toApiCountry(selectedRegion),
      });
      setRecordState('recorded');
      toast.success(
        'Recorded once. This does not contact anyone — if you need help now, use a phone line above.'
      );
    } catch (caught) {
      setRecordState('idle');
      toast.error(
        caught?.message ||
          'We could not record that just now. Please use one of the phone lines on this page.'
      );
    }
  };

  const toggleReachOut = (index) => {
    setCheckedReachOut((current) =>
      current.map((value, position) => (position === index ? !value : value))
    );
  };

  return (
    <div className="container-page py-6 sm:py-10">
      {/* Hero --------------------------------------------------------------- */}
      <section
        aria-labelledby="crisis-hero-title"
        className="relative overflow-hidden rounded-3xl border border-crisis-200 bg-gradient-to-br from-crisis-50 via-surface to-accent-50 px-5 py-8 shadow-card sm:px-8 sm:py-10"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-crisis-200/40 blur-3xl"
        />
        <p className="eyebrow-divine !text-crisis-600">Immediate support</p>
        <h1 id="crisis-hero-title" className="mt-2 font-serif text-3xl text-crisis-800 sm:text-4xl">
          Get help right now
        </h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-crisis-700/90">
          If you are in crisis or frightened by your own thoughts, help exists and you deserve it.
          Feelings like this are not permanent. You do not have to explain yourself perfectly to
          reach a person.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {loading && !resources ? (
            <div className="flex flex-col gap-2 sm:flex-row" aria-busy="true">
              <span className="sr-only">Loading phone numbers for your region</span>
              <div className="skeleton h-11 w-44 rounded-md" />
              <div className="skeleton h-11 w-44 rounded-md" />
            </div>
          ) : null}

          {primary ? <ResourceActionLink resource={primary} /> : null}
          {textLine ? <ResourceActionLink resource={textLine} tone="secondary" /> : null}
          {emergency ? <ResourceActionLink resource={emergency} tone="emergency" /> : null}

          {!loading && !primary && !textLine ? (
            <a
              href={internationalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-crisis-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-crisis-600"
            >
              Find a helpline in your country
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}

          {!loading && !emergency ? (
            <p className="text-sm text-crisis-700">
              If you are in immediate danger, call your local emergency number.
            </p>
          ) : null}
        </div>

        <div className="mt-6 rounded-lg border border-crisis-200 bg-surface/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-crisis-800">Record that you asked for help</h2>
              <p className="mt-1 text-xs leading-relaxed text-crisis-700/90">
                This saves an anonymous event — level <span className="font-medium">high</span>,
                source <span className="font-medium">manual</span>, region only. It does not contact
                a person or a crisis service, and nobody is alerted.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRecordRequest}
              disabled={recordState === 'saving' || recordState === 'recorded'}
              aria-live="polite"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border border-crisis-300 bg-surface px-4 py-2 text-sm font-semibold text-crisis-700 hover:bg-crisis-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {recordState === 'saving'
                ? 'Recording…'
                : recordState === 'recorded'
                  ? 'Request recorded ✓'
                  : 'Record my request for help'}
            </button>
          </div>
          {recordState === 'recorded' ? (
            <p className="mt-2 text-xs font-medium text-crisis-700">
              Recorded once. Recording again is not needed — for immediate help, please call a line
              above.
            </p>
          ) : null}
        </div>
      </section>

      {/* Verified resources -------------------------------------------------- */}
      <section aria-labelledby="crisis-resources-title" className="mt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="crisis-resources-title" className="font-serif text-2xl text-ink">
              Verified helplines
            </h2>
            <p className="mt-1 max-w-prose text-sm text-ink-muted">
              Numbers come from our verified directory, not typed into this page. Every card shows
              when it was last checked.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <label htmlFor="crisis-region" className="label">
              Where are you?
            </label>
            <select
              id="crisis-region"
              className="select min-h-[44px]"
              value={selectedRegion}
              onChange={handleRegionChange}
            >
              {!selectedRegion ? (
                <option value="" disabled>
                  Detecting region…
                </option>
              ) : null}
              {REGION_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="hint">
              Only this region code is saved on your device. It is never linked to what you write.
            </p>
          </div>
        </div>

        <div className="mt-5">
          {loading && !resources ? (
            <LoadingBlock label="Loading verified helplines" rows={2} />
          ) : null}

          {error && !loading ? (
            <div className="mb-4">
              <ErrorState
                title="We could not load local helplines"
                description="The verified directory did not respond. The emergency pointer and the international directory below still work."
                onRetry={refetch}
                retryLabel="Try loading helplines again"
                requestId={error.requestId}
              />
            </div>
          ) : null}

          {showFallbackHelp || (!loading && !resources) ? (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <Alert tone="crisis" title="If you are in immediate danger">
                <p>
                  Call your local emergency number now. We cannot see this page, cannot monitor you,
                  and cannot send help on your behalf.
                </p>
              </Alert>
              <Alert tone="info" title="Find a helpline anywhere in the world">
                <p>
                  <a
                    href={internationalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link font-semibold"
                  >
                    findahelpline.com
                  </a>{' '}
                  lists verified helplines by country. {FIND_A_HELPLINE.description}
                </p>
              </Alert>
            </div>
          ) : null}

          {resources ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {primary ? (
                <CrisisResourceCard
                  resource={primary}
                  lastVerified={resources.lastVerified}
                  tone="crisis"
                />
              ) : null}
              {textLine ? (
                <CrisisResourceCard resource={textLine} lastVerified={resources.lastVerified} />
              ) : null}
              {emergency ? (
                <CrisisResourceCard
                  resource={emergency}
                  lastVerified={resources.lastVerified}
                  tone="crisis"
                />
              ) : null}

              {local.length > 0 ? (
                <div className="lg:col-span-3">
                  <h3 className="mt-2 font-serif text-lg text-ink">
                    Other lines {regionName ? `in ${regionName}` : 'in your region'}
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {local.map((entry) => (
                      <CrisisResourceCard
                        key={`${entry.name}-${entry.contact}-${entry.type}`}
                        resource={entry}
                        lastVerified={resources.lastVerified}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="lg:col-span-3">
                <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-base text-ink">Somewhere else in the world?</h3>
                      <Badge tone="neutral">International directory</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {FIND_A_HELPLINE.description} {FIND_A_HELPLINE.available}
                    </p>
                  </div>
                  <a
                    href={internationalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink hover:border-line-strong hover:bg-paper"
                  >
                    Open findahelpline.com
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
                <p className="mt-3 text-xs text-ink-muted">
                  Helpline details change. We show the directory&apos;s verification date rather than
                  guessing; if a number does not work, please use the international directory above.
                  {serverDisclaimer ? ` ${serverDisclaimer}` : ''}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Coping ------------------------------------------------------------- */}
      <section aria-labelledby="crisis-coping-title" className="mt-10">
        <h2 id="crisis-coping-title" className="font-serif text-2xl text-ink">
          Things you can do in the next few minutes
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          These are not a cure and not a substitute for human help. They can lower the intensity
          enough for you to choose your next step.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-serif text-lg text-ink">Breathing: 4-4-6</h3>
            <p className="mt-1 text-sm text-ink-muted">
              A slower out-breath is one of the quickest ways to signal safety to your body.
            </p>
            <BreathingExercise className="mt-4" />
          </div>

          <div className="card p-5">
            <h3 className="font-serif text-lg text-ink">Grounding: 5-4-3-2-1</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Move your attention into the room, one sense at a time.
            </p>
            <ol className="mt-4 space-y-3">
              {GROUNDING_STEPS.map((step) => (
                <li key={step.count} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-800"
                  >
                    {step.count}
                  </span>
                  <span className="text-sm text-ink-soft">
                    {step.label} <span className="text-ink-muted">— {step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-5">
            <h3 className="font-serif text-lg text-ink">Cold-water technique</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Cooling your face can briefly slow your heart rate and interrupt intense distress. It
              is a short reset, not a treatment.
            </p>
            <ul className="mt-4 space-y-2">
              {COLD_WATER_STEPS.map((step) => (
                <li key={step} className="flex gap-2 text-sm text-ink-soft">
                  <span aria-hidden="true" className="text-primary-600">
                    •
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-muted">
              Do not use cold-water techniques while driving, in water, or if you have a heart
              condition — ask a clinician instead.
            </p>
          </div>

          <div className="card p-5">
            <h3 className="font-serif text-lg text-ink">Reach-out checklist</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Tick what you have done. This list stays in this tab — it is not saved or sent.
            </p>
            <ul className="mt-4 space-y-3">
              {REACH_OUT_ITEMS.map((item, index) => (
                <li key={item}>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-line text-primary-700 focus:ring-primary-500"
                      checked={checkedReachOut[index]}
                      onChange={() => toggleReachOut(index)}
                    />
                    <span className={checkedReachOut[index] ? 'text-ink-muted line-through' : ''}>
                      {item}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Warning signs + how to help --------------------------------------- */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-serif text-xl text-ink">
            Warning signs in yourself or someone else
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Recognising these is not a diagnosis, and their absence does not mean someone is fine.
            They are reasons to ask directly and to get support.
          </p>
          <ul className="mt-4 space-y-2">
            {WARNING_SIGNS.map((sign) => (
              <li key={sign} className="flex gap-2 text-sm text-ink-soft">
                <span aria-hidden="true" className="text-accent-600">
                  ▲
                </span>
                <span>{sign}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="font-serif text-xl text-ink">How to help someone in crisis</h2>
          <p className="mt-1 text-sm text-ink-muted">
            You are not their therapist, and you do not need the perfect words. Staying calm and
            taking it seriously matters more.
          </p>
          <ol className="mt-4 space-y-2">
            {HOW_TO_HELP.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-ink-soft">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-support-50 text-xs font-semibold text-support-600"
                >
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-ink-muted">
            If you are worried about immediate risk, contact emergency services or help the person
            reach a crisis line rather than waiting.
          </p>
        </div>
      </section>

      {/* Privacy + limits --------------------------------------------------- */}
      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="surface-muted p-5">
          <h2 className="font-serif text-lg text-ink">What we store — and what we never store</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-primary-600">
                ✓
              </span>
              <span>
                When resources are shown we store only metadata: the level, the source (for example
                &quot;manual&quot;), and the region.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-primary-600">
                ✓
              </span>
              <span>
                The region you choose is saved on this device only, as a two-letter code. Nothing
                else is kept in your browser.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-crisis-600">
                ✕
              </span>
              <span>
                We never store the words you type on this page. There is no crisis chat here, so
                there is nothing to save.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true" className="text-crisis-600">
                ✕
              </span>
              <span>We do not use your location, IP address or device to work out your country.</span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg border border-accent-200 bg-accent-50 p-5">
          <h2 className="font-serif text-lg text-accent-800">Important limits</h2>
          <p className="mt-2 text-sm leading-relaxed text-accent-800">
            AdiYogi is not a crisis service. Nobody is watching this page, and we cannot detect or
            respond to an emergency. No message you send through this site is monitored in real
            time. If you need help now, contact a helpline or emergency services directly — those
            are real people, not an app.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-accent-800">
            Our AI companion is not a therapist or a doctor. It cannot diagnose you and it cannot
            monitor you. For immediate danger, always use a phone line.
          </p>
        </div>
      </section>

      <div className="mt-10 rounded-lg border border-line bg-surface p-5 text-center">
        <p className="font-serif text-lg text-ink">You matter, and this can change.</p>
        <p className="mx-auto mt-1 max-w-prose text-sm text-ink-muted">
          Reaching out is a skill, and you are already practising it by reading this page.
        </p>
        <Link to="/resources" className="link mt-3 inline-block text-sm font-semibold">
          Read more about anxiety, low mood, sleep and supporting others →
        </Link>
      </div>
    </div>
  );
}
