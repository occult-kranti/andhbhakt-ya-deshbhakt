/**
 * screens/files/brief.tsx — the file brief: one manila cover that holds a hub's ONE primary action
 * (Open / Resume / Replay file → #/route/:id). Used by Kiska Media?, Forward Court and the money trail.
 *
 * States are words first (bible §3.3): "Sealed. Tape cut on first card." + the red tape; "3 of 6
 * answered" + a meter; "Cleared" + a CLEARED stamp (≥ 20px, not animated on a hub). The brief never
 * shows a card's answer.
 */
import { useId, type ReactNode } from 'react';
import type { Route } from '../../../edition';
import { href } from '../../router';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { Meter } from '../../ui/meter';
import { Skeleton } from '../../ui/skeleton';
import { Stamp } from '../../ui/stamp';
import { Tape } from '../../ui/tape';
import { CARDS, fileNo, openWords, statusWords, type FileStatus } from './lib';
import '../../ui/file-card.css';
import './brief.css';

const DEVANAGARI = /[\u0900-\u097F]/;

export type BriefFact = { k: string; v: ReactNode };

export type FileBriefProps = {
  route: Route;
  status: FileStatus;
  loaded: boolean;
  /** Mono kicker above the titles ("Next file", "Press file"). */
  kicker?: string;
  titleHi?: string;
  title: ReactNode;
  /** One line under the status (copy, a chip row). */
  lead?: ReactNode;
  facts?: readonly BriefFact[];
  /** Words on the primary button when the file is untouched (default "Open file"). */
  openLabel?: string;
  /** Extra content after the button (a secondary link). */
  children?: ReactNode;
  className?: string;
  /** Heading level of the title (h2 on a hub). */
  as?: 'h2' | 'h3';
  id?: string;
};

export function FileBrief({
  route,
  status,
  loaded,
  kicker,
  titleHi,
  title,
  lead,
  facts,
  openLabel,
  children,
  className,
  as: Heading = 'h2',
  id,
}: FileBriefProps) {
  const { t } = useLang();
  const headId = useId();
  const duelFile = route.kind === 'media' ? 'media' : route.kind === 'pre-election' ? 'pre-election' : route.kind === 'distribution' ? 'subsidies' : 'all';
  if (!loaded) return <Skeleton lines={5} label={t('Opening the file', 'फ़ाइल खुल रही है')} className={cx('h-brief', className)} />;
  const state = status.state === 'cleared' ? 'cleared' : status.state === 'progress' ? 'open' : 'sealed';
  const words = !status.running && status.state === 'sealed' && openLabel ? openLabel : openWords(status, t);
  return (
    <section className={cx('h-file', `h-file--${state}`, 'h-brief', className)} aria-labelledby={headId} id={id}>
      <span className="h-file__tab">{fileNo(route)}</span>
      <div className="h-brief__head">
        <div className="h-brief__titles">
          {kicker ? <p className="h-brief__kicker">{kicker}</p> : null}
          {titleHi ? (
            <p className="h-brief__hi" lang="hi">
              {titleHi}
            </p>
          ) : null}
          {/* A Latin title keeps its caps in the Hindi locale ('UTTAR PRADESH', 'KISKA MEDIA?'): it is
              English (lang="en"); a Devanagari one is lang="hi" and untracked (bible §4.4). */}
          <Heading className="h-brief__title" id={headId} lang={typeof title === 'string' ? (DEVANAGARI.test(title) ? 'hi' : 'en') : undefined}>
            {title}
          </Heading>
        </div>
      </div>
      <div className="h-brief__statusrow">
        <p className="h-brief__status">{statusWords(status, t)}</p>
        {status.state === 'cleared' ? (
          <span className="h-brief__stamp">
            <Stamp kind="noted" seed={route.id} text="CLEARED" size="l" label={t('File cleared', 'फ़ाइल क्लियर')} />
          </span>
        ) : null}
      </div>
      {status.state === 'sealed' && !status.running ? <Tape /> : null}
      {status.running ? (
        <Meter
          value={status.done}
          max={CARDS}
          ticks={CARDS}
          label={t('Cards answered', 'जवाब दिए कार्ड')}
          valueText={`${status.done} of ${CARDS} answered`}
          className="h-brief__meter"
        />
      ) : null}
      {lead ? <div className="h-brief__lead">{lead}</div> : null}
      {facts?.length ? (
        <dl className="h-brief__facts">
          {facts.map((f) => (
            <div key={f.k}>
              <dt>{f.k}</dt>
              <dd>{f.v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Button variant="primary" block href={href.online('play', { file: duelFile })}>
        {duelFile === 'all' ? t('Find a human duel', 'इंसानी मुक़ाबला ढूँढ़ो') : t('Duel this topic', 'इस विषय पर मुक़ाबला')}
      </Button>
      <p className="h-meta">{t('Human duel, optional stake. Or learn solo below.', 'इंसानी मुक़ाबला, वैकल्पिक सिक्के। या नीचे अकेले सीखें।')}</p>
      <Button variant="paper" block href={href.route(route.id)}>
        {t('Solo learning · ', 'अकेले सीखें · ')}{words}
      </Button>
      {children}
    </section>
  );
}
