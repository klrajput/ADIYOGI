import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { classNames } from '../../lib/format';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  accent: 'btn-accent',
  crisis: 'btn-crisis',
};

const SIZES = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

/**
 * Single button primitive. Renders a <button> by default, a react-router <Link>
 * when `to` is provided, or an <a> when `href` is provided — so links are real
 * links (middle-click, keyboard, and screen readers work as expected).
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', to, href, className, children, type = 'button', loading = false, disabled, ...rest },
  ref
) {
  // Touch devices get a >=40px target regardless of the visual size step.
  const classes = classNames(
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size],
    '[@media(pointer:coarse)]:min-h-[2.5rem]',
    className
  );
  const isDisabled = disabled || loading;
  const content = (
    <>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} aria-disabled={isDisabled || undefined} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={isDisabled} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export default Button;
