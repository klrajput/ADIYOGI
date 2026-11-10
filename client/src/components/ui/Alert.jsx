import { classNames } from '../../lib/format';

const TONES = {
  info: 'border-support-200 bg-support-50 text-support-600',
  success: 'border-primary-200 bg-primary-50 text-primary-800',
  warning: 'border-accent-200 bg-accent-50 text-accent-800',
  crisis: 'border-crisis-200 bg-crisis-50 text-crisis-600',
};

/**
 * Inline message block. Use `role="alert"` for errors and `status` for successes.
 * Crisis tone is reserved for safety messaging.
 */
export default function Alert({ tone = 'info', title, children, action, className, icon }) {
  const isError = tone === 'crisis' || tone === 'warning';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={classNames('rounded-lg border px-4 py-3 text-sm', TONES[tone] || TONES.info, className)}
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <span aria-hidden="true" className="text-base leading-6">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={classNames(title && 'mt-1', 'leading-relaxed')}>{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
