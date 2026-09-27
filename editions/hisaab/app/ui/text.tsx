/**
 * ui/text.tsx — small typographic pieces every screen uses.
 *
 *   <Hi>अंधभक्त या देशभक्त</Hi>                       Devanagari inside an English screen (lang="hi", untracked)
 *   <Kicker>F.No. S/UP/06</Kicker>          mono caps kicker (12px — kickers only, never a sentence)
 *   <Mono>₹1.2 lakh crore</Mono>            typewriter numbers, codes, ₹ (Latin/digits only)
 */
import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

/** A Devanagari span inside an English screen: lang="hi", no letter-spacing (bible §4.4). */
export function Hi({ children, className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span lang="hi" className={cx('h-hi', className)} {...rest}>
      {children}
    </span>
  );
}

/** A mono caps kicker (F.No. codes, section labels). */
export function Kicker({ children, className, as: Tag = 'p', ...rest }: HTMLAttributes<HTMLElement> & { as?: 'p' | 'span' | 'div' }) {
  return (
    <Tag className={cx('h-kicker', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Sometype Mono with tabular digits — for ₹, counts, file numbers. Never wrap Devanagari in it. */
export function Mono({ children, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span className={cx('h-mono', className)} {...rest}>
      {children}
    </span>
  );
}

/** Visually hidden, read by screen readers. */
export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="h-sr">{children}</span>;
}
