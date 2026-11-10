import { classNames } from '../../lib/format';

const TONES = {
  primary: 'badge-primary',
  accent: 'badge-accent',
  crisis: 'badge-crisis',
  neutral: 'badge-neutral',
};

export default function Badge({ tone = 'neutral', className, children, ...rest }) {
  return (
    <span className={classNames(TONES[tone] || TONES.neutral, className)} {...rest}>
      {children}
    </span>
  );
}
