/**
 * ui/page.tsx — screen scaffolding: the page column, the screen header, empty and error states.
 *
 *   <Page>                                            max 1200px, 16px gutters, bottom-bar clearance
 *     <ScreenHeader kicker="F.No. R/IN" titleHi="राज्य राउंड्स" title="Rajya Rounds" lead="Pick a state." />
 *     …
 *   </Page>
 *   <EmptyState line="Tijori khaali hai. First receipt goes here." action={<Button …/>} />
 *   <ErrorState onRetry={reload} />                   "File missing. Babu is on leave." + Retry
 */
import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from './button';
import { cx } from './cx';
import { Kicker } from './text';
import './page.css';

export type PageProps = {
  children: ReactNode;
  /** 'wide' = the full 1200px (default); 'read' = a 62ch reading column (rules, noting). */
  width?: 'wide' | 'read' | 'play';
  className?: string;
  /** Screen id for tests and the mobile gate: <section data-screen="home">. */
  screen?: string;
};

export function Page({ children, width = 'wide', className, screen }: PageProps) {
  return (
    <section className={cx('h-page', width !== 'wide' && `h-page--${width}`, className)} data-screen={screen}>
      {children}
    </section>
  );
}

export type ScreenHeaderProps = {
  /** Mono kicker above the title (a file number, a section). */
  kicker?: ReactNode;
  /** Devanagari line above the Latin title (lang="hi" is set for you). */
  titleHi?: string;
  /** The Latin title (rendered uppercase). This is the page's <h1>. */
  title: ReactNode;
  lead?: ReactNode;
  /** Right-hand slot on wide screens (a filter, a toggle). */
  aside?: ReactNode;
  /** Heading id, e.g. for aria-labelledby. */
  id?: string;
  /**
   * Language of `title`. Strings with Devanagari use 'hi'; other strings use 'en'.
   * Nodes inherit unless the caller supplies a language.
   */
  titleLang?: 'en' | 'hi';
};

const DEVANAGARI = /[\u0900-\u097F]/;
/** Detect script before selecting editorial type so user names retain readable Hindi glyphs. */
const autoTitleLang = (title: ReactNode): 'en' | 'hi' | undefined =>
  typeof title === 'string' ? (DEVANAGARI.test(title) ? 'hi' : 'en') : undefined;

export function ScreenHeader({ kicker, titleHi, title, lead, aside, id, titleLang }: ScreenHeaderProps) {
  return (
    <header className="h-screenhead">
      <div className="h-screenhead__main">
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <h1 className="h-title" id={id}>
          {titleHi ? (
            <span className="h-title__hi" lang="hi">
              {titleHi}
            </span>
          ) : null}
          <span className="h-title__en" lang={titleLang ?? autoTitleLang(title)}>
            {title}
          </span>
        </h1>
        {lead ? <p className="h-lead">{lead}</p> : null}
      </div>
      {aside ? <div className="h-screenhead__aside">{aside}</div> : null}
    </header>
  );
}

export type EmptyStateProps = { line: ReactNode; action?: ReactNode; className?: string };

/** One line of satire + one action (bible §11 shared states). */
export function EmptyState({ line, action, className }: EmptyStateProps) {
  return (
    <div className={cx('h-empty', className)}>
      <p className="h-empty__line">{line}</p>
      {action ? <div className="h-empty__action">{action}</div> : null}
    </div>
  );
}

export type ErrorStateProps = { title?: ReactNode; detail?: ReactNode; onRetry?: () => void; retryLabel?: string };

/** "File missing. Babu is on leave." + Retry. Inline, never a toast. */
export function ErrorState({ title = 'File missing. Babu is on leave.', detail, onRetry, retryLabel = 'Retry' }: ErrorStateProps) {
  return (
    <div className="h-error" role="alert">
      <p className="h-error__title">{title}</p>
      {detail ? <p className="h-error__detail">{detail}</p> : null}
      {onRetry ? (
        <Button variant="paper" size="s" icon={<RotateCcw size={18} />} onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** An inline notice (offline, storage unavailable). Polite live region; not a toast. */
export function InlineNote({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'wait' }) {
  return (
    <p className={cx('h-note', tone === 'wait' && 'h-note--wait')} role="status">
      {children}
    </p>
  );
}
