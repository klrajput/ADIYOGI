import { classNames } from '../../lib/format';

export function Card({ as: Tag = 'div', interactive = false, className, children, ...rest }) {
  return (
    <Tag className={classNames(interactive ? 'card-interactive' : 'card', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={classNames('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="font-serif text-lg leading-snug text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={classNames('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return <div className={classNames('border-t border-line px-5 py-3', className)}>{children}</div>;
}

export default Card;
