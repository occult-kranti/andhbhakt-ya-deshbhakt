/**
 * screens/receipts/detail.tsx — one receipt in full: the question, the answer, your record on it, the
 * receipt (SOURCE / STATUS + as of / GOVT THEN / money-trail rows), the noting, and the actions —
 * Open source ↗, Keep a copy, Forward this (receipt card), Send as a challenge (answer not marked), Report a change.
 *
 * Keep a copy is the engine's `save` (the "Keep a copy of 2 receipts" quest and the Stamp Register's
 * "Kept copies"). The engine's save is a toggle that pays on every save, so a kept copy stays kept here:
 * the button confirms "Kept ✓" in place and never un-keeps (no save/unsave loop to farm XP).
 *
 * Status honesty: the legal status line is the bank's, verbatim, with its as-of month; one verified
 * more than six months ago carries a neutral "Status older than 6 months" note. A receipt whose noting
 * changed since it was collected shows the old noting struck through. One WITHDRAWN from the bank shows
 * only its kicker, its stem struck through and a pointer to the Corrections log — no answer, no noting,
 * no source (charter §2.2/§2.3: what a withdrawal pulls is not shown again, not even from the journal).
 */
import { useRef, useState } from 'react';
import { Check, CopyCheck, CopyPlus, ExternalLink, Flag, History, Send } from 'lucide-react';
import { asOfText, formatNumber, monthLabel, stateName } from '../../data';
import { href, queryString } from '../../router';
import { shareReceipt, ShareButton } from '../../share';
import { useAppPlayer } from '../../shell/player';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';
import { NotingSheet } from '../../ui/noting-sheet';
import { Receipt } from '../../ui/receipt';
import { Stamp } from '../../ui/stamp';
import { shortDate } from '../me/lib';
import { monthsSince, STALE_MONTHS, type ReceiptRow, type Surface } from './lib';

const SURFACE_NAMES: Record<Surface, [string, string]> = {
  expedition: ['a file', 'एक फ़ाइल'],
  discovery: ['Aaj Ka Hisaab / a one-card link', 'आज का हिसाब / एक-कार्ड लिंक'],
  duel: ['a duel', 'एक मुक़ाबला'],
  recall: ['Dobara Jaanch', 'दोबारा जाँच'],
  event: ['an event', 'एक इवेंट'],
};

/** 'F.No. HSC001 · Health · Centre · 2019' */
export function receiptKicker(row: ReceiptRow) {
  return ['F.No. ' + row.id.toUpperCase(), row.topic, row.state ? stateName(row.state) : null, row.year ? String(row.year) : null].filter(Boolean).join(' · ');
}

export function reportHref(id: string) {
  return `${href.rules()}${queryString({ s: 'report', id })}`;
}

type KeepJournal = {
  saved?: readonly string[];
  rounds?: ReadonlyArray<{ factId?: string; question?: string }>;
  cards?: Readonly<Record<string, { question?: string } | undefined>>;
} | null | undefined;

/**
 * The question text the engine keys a kept copy on — the journal's own snapshot, looked up in the same
 * order as the engine's save (its round first, then its card). Null when the journal no longer holds it.
 */
function journalQuestion(journal: KeepJournal, id: string): string | null {
  const round = journal?.rounds?.find((r) => r.factId === id);
  return round?.question ?? journal?.cards?.[id]?.question ?? null;
}

/** "Keep a copy" → "Kept ✓", in place (bible §9: confirmations are inline, not toasts). */
function KeepCopy({ id }: { id: string }) {
  const player = useAppPlayer();
  const { t } = useLang();
  const journal = player.journal as KeepJournal;
  const question = journalQuestion(journal, id);
  const [pressed, setPressed] = useState(false);
  const sent = useRef(false);
  if (!question) return null;
  const kept = pressed || (journal?.saved ?? []).includes(question);
  const keep = () => {
    // The engine's save toggles: a second dispatch would un-keep it, so only the first tap sends.
    if (kept || sent.current) return;
    sent.current = true;
    setPressed(true);
    void player.dispatch({ type: 'save', factId: id });
  };
  return (
    <Button
      variant="paper"
      className="h-rdetail__keep"
      data-kept={kept || undefined}
      icon={kept ? <CopyCheck size={20} strokeWidth={2.4} /> : <CopyPlus size={20} strokeWidth={2.4} />}
      onClick={keep}
    >
      <span aria-live="polite">{kept ? t('Kept ✓', 'रख ली ✓') : t('Keep a copy', 'कॉपी रखो')}</span>
    </Button>
  );
}

/** A receipt whose item has left the bank: what it was, struck through, and where the log says why. */
function WithdrawnDetail({ row, H }: { row: ReceiptRow; H: 'h2' | 'h3' }) {
  const { t } = useLang();
  return (
    <article className="h-rdetail" aria-label={t('Withdrawn receipt', 'हटाई गई रसीद')}>
      <p className="h-kicker">{receiptKicker(row)}</p>
      <H className="h-rdetail__q">
        <del>{row.question}</del>
      </H>
      <p className="h-note" role="note">
        {t('Withdrawn from the files', 'फ़ाइलों से हटा दी गई')} —{' '}
        <a className="h-link" href={href.rules('corrections')}>
          {t('see the Corrections log', 'सुधार सूची देखो')}
        </a>
      </p>
    </article>
  );
}

export function ReceiptDetail({ row, headingLevel = 3 }: { row: ReceiptRow; headingLevel?: 2 | 3 }) {
  const { t, locale } = useLang();
  const H = headingLevel === 2 ? 'h2' : 'h3';
  if (row.withdrawn) return <WithdrawnDetail row={row} H={H} />;
  const answer = row.options[row.correctIndex];
  const record =
    row.lastCorrect === null
      ? null
      : row.lastCorrect
        ? { kind: 'pass' as const, text: 'WAAH WAAH' }
        : { kind: 'fail' as const, text: 'GALAT · OBJECTION' };
  return (
    <article className="h-rdetail" aria-label={t('Receipt', 'रसीद')}>
      <p className="h-kicker">{receiptKicker(row)}</p>
      <H className="h-rdetail__q">{row.question}</H>

      <div className="h-rdetail__answer">
        <span className="h-rdetail__k">{t('Answer', 'जवाब')}</span>
        <p className="h-rdetail__a">
          <Check size={20} strokeWidth={3} aria-hidden="true" className="h-rdetail__tick" />
          {answer}
        </p>
      </div>

      <div className="h-rdetail__record h-stamp-stage">
        {record ? <Stamp kind={record.kind} seed={row.id} size="m" text={record.text} label={t('Your last answer', 'आपका पिछला जवाब')} /> : null}
        <p className="h-rdetail__recordtext">
          {t('Answered', 'जवाब दिए')} <span className="h-mono">{formatNumber(row.seen)}</span>
          {row.seen === 1 ? t(' time', ' बार') : t(' times', ' बार')}, <span className="h-mono">{formatNumber(row.right)}</span> {t('right', 'सही')}.
          {row.lastAt ? ` ${t('Last', 'पिछली बार')}: ${shortDate(row.lastAt)}.` : ''}
          {row.surfaces.length ? ` ${t('Collected in', 'कहाँ मिली:')} ${row.surfaces.map((s) => t(...SURFACE_NAMES[s])).join(', ')}.` : ''}
        </p>
      </div>

      {row.stale && row.asOf ? (
        <p className="h-note" role="note">
          <History size={16} strokeWidth={2.4} aria-hidden="true" className="h-rdetail__noteicon" />
          {t(
            `Status older than ${STALE_MONTHS} months: last verified in ${monthLabel(row.asOf)} (${monthsSince(row.asOf)} months ago). Open the source; if the case has moved on, report it.`,
            `${STALE_MONTHS} महीने से पुरानी स्थिति: ${asOfText(row.asOf, locale)} जाँची गई थी। स्रोत खोलें; अगर मामला आगे बढ़ा है, बताएँ।`,
          )}
        </p>
      ) : null}

      {row.item ? <Receipt item={row.item} label={t('Receipt', 'रसीद')} /> : null}

      <NotingSheet>
        <p>{row.explanation}</p>
        {row.updated && row.oldExplanation ? (
          <details className="h-rdetail__old">
            <summary className="h-rdetail__oldsum">
              {t('Updated since you collected it', 'आपके लेने के बाद बदली')}
              {row.asOf ? ` · ${asOfText(row.asOf, locale)}` : ''} — {t('what it said then', 'तब क्या लिखा था')}
            </summary>
            <p>
              <del>{row.oldExplanation}</del>
            </p>
          </details>
        ) : null}
      </NotingSheet>

      <div className="h-rdetail__actions">
        <Button variant="paper" href={row.sourceUrl} target="_blank" rel="noopener noreferrer" trailing={<ExternalLink size={18} strokeWidth={2.4} />}>
          {t('Open source', 'स्रोत खोलो')}
          <span className="h-sr"> {t('(opens in a new tab)', '(नए टैब में)')}</span>
        </Button>
        <KeepCopy key={row.id} id={row.id} />
        {row.item ? <ShareButton run={() => shareReceipt(row.item!, 'receipt')} /> : null}
        {row.item ? (
          <ShareButton icon={<Send size={20} strokeWidth={2.4} />} variant="ghost" run={() => shareReceipt(row.item!, 'challenge')}>
            {/* Honest words: the card leaves the answer unmarked, but a case's legal status line always
                travels with it (charter §2.2) and can give the answer away. */}
            {t('Send as a challenge (answer not marked)', 'चुनौती भेजो (जवाब चिह्नित नहीं)')}
          </ShareButton>
        ) : null}
        <Button variant="ghost" href={reportHref(row.id)} icon={<Flag size={18} strokeWidth={2.4} />} trailing={null}>
          {t('Report a change or an error', 'बदलाव या ग़लती बताओ')}
        </Button>
      </div>
      {row.status ? (
        <p className="h-rdetail__fine">{t('Nobody named here is guilty unless convicted.', 'दोषसिद्धि के बिना यहाँ कोई दोषी नहीं।')}</p>
      ) : null}
    </article>
  );
}
