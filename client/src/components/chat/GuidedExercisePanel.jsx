/**
 * Explicitly non-AI coping exercise offered when the AI provider is unavailable
 * (`error.details.guidedExercise = {title, steps[]}`).
 *
 * It is rendered locally, is clearly labelled, and is never inserted into the
 * conversation as an assistant message.
 */
export default function GuidedExercisePanel({ exercise, expanded, onToggle }) {
  if (!exercise) return null;

  const title = typeof exercise === 'string' ? null : String(exercise.title || '');
  const rawSteps = typeof exercise === 'string' ? [exercise] : exercise.steps;
  const steps = Array.isArray(rawSteps)
    ? rawSteps.map((step) => String(step).trim()).filter(Boolean)
    : [];

  if (steps.length === 0 && !title) return null;

  const panelId = 'guided-exercise-panel';

  return (
    <div className="mt-3 rounded-lg border border-support-200 bg-support-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="badge-neutral">Guided exercise</span>
          <span className="text-xs font-medium text-support-600">Not AI · fixed content</span>
        </div>
        <button
          type="button"
          className="btn-secondary btn-sm min-h-[40px]"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
        >
          {expanded ? 'Hide guided exercise' : 'Use a guided exercise instead (not AI)'}
        </button>
      </div>

      {expanded ? (
        <div id={panelId} className="mt-3">
          {title ? <h3 className="font-serif text-base text-support-600">{title}</h3> : null}
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
            {steps.map((step, index) => (
              <li key={`${index}-${step}`}>{step}</li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-ink-muted">
            This is a standard coping exercise, not a reply generated for you. It does not replace
            human help.
          </p>
        </div>
      ) : null}
    </div>
  );
}
