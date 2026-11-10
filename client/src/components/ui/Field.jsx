import { useId } from 'react';
import { classNames } from '../../lib/format';

/** Accessible label + control + hint + error wrapper. */
export function Field({ label, htmlFor, hint, error, required, className, children }) {
  return (
    <div className={classNames('mb-4', className)}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="ml-1 text-crisis-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="hint text-ink-muted">{hint}</p> : null}
      {error ? (
        <p className="field-error" role="alert" id={htmlFor ? `${htmlFor}-error` : undefined}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ label, hint, error, required, id, className, ...rest }) {
  const generatedId = useId();
  const inputId = id || `input-${generatedId}`;
  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error} required={required}>
      <input
        id={inputId}
        className={classNames('input', error && 'border-crisis-400 focus:border-crisis-500 focus:ring-crisis-500/25', className)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        required={required}
        {...rest}
      />
    </Field>
  );
}

export function Textarea({ label, hint, error, required, id, className, maxLength, value = '', showCount = true, ...rest }) {
  const generatedId = useId();
  const inputId = id || `textarea-${generatedId}`;
  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <textarea
        id={inputId}
        className={classNames('textarea', error && 'border-crisis-400 focus:border-crisis-500 focus:ring-crisis-500/25')}
        aria-invalid={error ? 'true' : undefined}
        required={required}
        maxLength={maxLength}
        value={value}
        {...rest}
      />
      {maxLength && showCount ? (
        <div className="hint flex justify-between" aria-hidden="true">
          <span />
          <span className={classNames(value.length > maxLength * 0.9 && 'text-accent-600')}>
            {value.length}/{maxLength}
          </span>
        </div>
      ) : null}
    </Field>
  );
}

export function Select({ label, hint, error, required, id, className, children, ...rest }) {
  const generatedId = useId();
  const inputId = id || `select-${generatedId}`;
  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error} required={required}>
      <select id={inputId} className={classNames('select', className)} required={required} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function Checkbox({ label, hint, error, id, className, ...rest }) {
  const generatedId = useId();
  const inputId = id || `checkbox-${generatedId}`;
  return (
    <div className={classNames('mb-4', className)}>
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-line text-primary-700 focus:ring-primary-500"
          {...rest}
        />
        <label htmlFor={inputId} className="text-sm text-ink-soft">
          {label}
          {hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
        </label>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
