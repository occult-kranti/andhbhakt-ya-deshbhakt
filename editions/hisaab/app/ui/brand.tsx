import { cx } from './cx';
import './brand.css';

/** The name and violet full stop stay recognisable from the masthead to compact chrome. */
export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cx('h-brand-name', className)} lang="en" aria-hidden="true">
      HISAAB DO<span className="h-brand-name__dot">.</span>
    </span>
  );
}
