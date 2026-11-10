import { useEffect, useRef } from 'react';
import { classNames } from '../../lib/format';

/**
 * Subtle scroll parallax. A single rAF-throttled listener translates the element by a
 * small factor of its distance from the viewport centre. Disabled entirely for
 * reduced-motion users and on coarse (touch) pointers where it costs more than it adds.
 */
export default function Parallax({ children, className, strength = 0.08, as: Tag = 'div' }) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    if (reduceMotion || coarse) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const centre = rect.top + rect.height / 2;
      const offset = (window.innerHeight / 2 - centre) * strength;
      node.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [strength]);

  return (
    <Tag ref={ref} className={classNames('will-change-transform', className)}>
      {children}
    </Tag>
  );
}
