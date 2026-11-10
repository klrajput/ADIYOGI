import { useEffect, useRef, useState } from 'react';
import { classNames } from '../../lib/format';

/**
 * Scroll-triggered reveal. Uses IntersectionObserver + CSS transitions (no animation
 * library, no layout thrash). Content is visible by default so the page still renders
 * when JavaScript or the observer is unavailable; the hidden state is only applied once
 * the component has mounted.
 */
export default function Reveal({
  as: Tag = 'div',
  children,
  className,
  delay = 0,
  y = 22,
  once = true,
  threshold = 0.12,
  ...rest
}) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -6% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once, threshold]);

  return (
    <Tag
      ref={ref}
      className={classNames(mounted && !visible ? 'reveal' : 'reveal reveal-in', className)}
      style={{
        transitionDelay: delay ? `${delay}ms` : undefined,
        ...(mounted && !visible ? { transform: `translateY(${y}px)` } : null),
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
