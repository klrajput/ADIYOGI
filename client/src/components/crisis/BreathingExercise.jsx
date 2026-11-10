import { useContext, useEffect, useState } from 'react';
import IdentityContext from '../../context/IdentityContext';

const PHASES = [
  { key: 'inhale', label: 'Breathe in', seconds: 4 },
  { key: 'hold', label: 'Hold', seconds: 4 },
  { key: 'exhale', label: 'Breathe out', seconds: 6 },
];

const TOTAL_ROUNDS = 4;

const IDLE_STATE = {
  running: false,
  phaseIndex: 0,
  secondsLeft: PHASES[0].seconds,
  rounds: 0,
  complete: false,
};

/** Pure state transition — safe to call from inside a state updater. */
function advance(state) {
  if (state.secondsLeft > 1) {
    return { ...state, secondsLeft: state.secondsLeft - 1 };
  }
  const nextPhase = (state.phaseIndex + 1) % PHASES.length;
  const completedRound = nextPhase === 0;
  const rounds = completedRound ? state.rounds + 1 : state.rounds;

  if (rounds >= TOTAL_ROUNDS) {
    return { ...IDLE_STATE, complete: true, rounds: TOTAL_ROUNDS };
  }
  return {
    running: true,
    phaseIndex: nextPhase,
    secondsLeft: PHASES[nextPhase].seconds,
    rounds,
    complete: false,
  };
}

function usePrefersReducedMotion() {
  const identityContext = useContext(IdentityContext);
  const preference = identityContext?.identity?.preferences?.reduceMotion;
  const [systemPrefers, setSystemPrefers] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event) => setSystemPrefers(event.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);

  return Boolean(preference) || systemPrefers;
}

/**
 * 4-4-6 breathing exercise.
 *
 * A single interval drives the whole cycle and is cleared on stop *and* on
 * unmount, so it cannot leak timers. The current phase is announced politely for
 * screen readers; animation is disabled when the visitor prefers reduced motion
 * (the countdown still works, because the exercise does not depend on animation).
 */
export default function BreathingExercise({ className = '' }) {
  const [state, setState] = useState(IDLE_STATE);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!state.running) return undefined;
    const timer = window.setInterval(() => setState((current) => advance(current)), 1000);
    return () => window.clearInterval(timer);
  }, [state.running]);

  const phase = PHASES[state.phaseIndex];

  const start = () => setState({ ...IDLE_STATE, running: true });
  const stop = () => setState({ ...IDLE_STATE });

  const scale = state.running ? (phase.key === 'exhale' ? 0.94 : 1.06) : 1;

  const announcement = state.running
    ? `${phase.label}. Round ${Math.min(state.rounds + 1, TOTAL_ROUNDS)} of ${TOTAL_ROUNDS}.`
    : state.complete
      ? 'Four rounds complete. Start again whenever you want.'
      : 'Ready. A 4-4-6 breathing exercise: in for four, hold for four, out for six.';

  return (
    <div className={`${className}`}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div
          aria-hidden="true"
          className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-primary-300 bg-primary-50 text-center ${
            reduceMotion ? '' : 'transition-transform'
          }`}
          style={
            reduceMotion
              ? undefined
              : {
                  transform: `scale(${scale})`,
                  transitionDuration: state.running ? `${phase.seconds}s` : '300ms',
                  transitionTimingFunction: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
                }
          }
        >
          <span className="font-serif text-2xl text-primary-800">
            {state.running ? state.secondsLeft : state.complete ? '✓' : '4-4-6'}
          </span>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-sm font-semibold text-primary-800" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Breathe in through your nose for 4, hold for 4, breathe out slowly for 6. Four rounds.
            Stop any time you feel dizzy or uncomfortable.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {state.running ? (
              <button type="button" className="btn-secondary min-h-[44px]" onClick={stop}>
                Stop exercise
              </button>
            ) : (
              <button type="button" className="btn-primary min-h-[44px]" onClick={start}>
                {state.complete ? 'Start again' : 'Start breathing exercise'}
              </button>
            )}
            <span className="text-xs text-ink-muted" aria-hidden="true">
              {state.running
                ? `Round ${Math.min(state.rounds + 1, TOTAL_ROUNDS)} of ${TOTAL_ROUNDS}`
                : `${TOTAL_ROUNDS} slow rounds`}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        {reduceMotion
          ? 'Animation is off because you prefer reduced motion — the timer still guides each phase.'
          : 'The circle grows on the in-breath and settles on the out-breath.'}
      </p>
    </div>
  );
}
