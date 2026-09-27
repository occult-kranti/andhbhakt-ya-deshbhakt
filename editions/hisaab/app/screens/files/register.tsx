/**
 * screens/files/register.tsx — a register (रजिस्टर) of bank entries that fills as the player collects
 * receipts: Kiska Media?'s "who owns what" and Forward Court's docket.
 *
 * Why sealed entries: an entry's body is the card's answer (the owner, the ruling). Printing it on a hub
 * would answer the file's questions before they are asked. An entry opens once its card is in the
 * player's journal — by playing the file, the daily, a duel, or the one-card taster a sealed entry
 * links to. A sealed entry shows only words its question already shows (`sealedTitle`, built with
 * lib.ts sealedName / claimOf), never the raw subtopic. Nothing is invented: every open entry prints
 * bank text verbatim, with the legal status and its as-of date where the item has one.
 */
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, CornerUpRight, ExternalLink, Lock, Scale } from 'lucide-react';
import { asOfText, sourceKind, type BankItem } from '../../data';
import { href, Link } from '../../router';
import { Chip, LegalStatus, SourceChip } from '../../ui/chip';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import './register.css';

export type RegisterEntry = {
  item: BankItem;
  /** Mono line above the title: 'KL · 2023'. Latin only. */
  kicker: string;
  /** What a SEALED entry may show — words from the question only. Null: the kicker alone. */
  sealedTitle: string | null;
  /** The entry's name once open (the subtopic is fine here: the card has been answered). */
  title: string;
  /** What an open entry shows between the title and the receipt rows. */
  body?: ReactNode;
};

export type RegisterProps = {
  title: string;
  titleHi?: string;
  /** One line under the title: how entries open. */
  lead: ReactNode;
  entries: readonly RegisterEntry[];
  /** Fact ids the player holds (journal). */
  held: ReadonlySet<string>;
  /** 'chip': mono text chips (outlet names); 'bubble': claims in a generic forwarded bubble. */
  sealedStyle?: 'chip' | 'bubble';
  /** Sealed entries shown before "Show all" (the rest stay one tap away). */
  sealedLimit?: number;
  /** Words on a sealed entry's link, e.g. "Answer this card". */
  sealedCta: string;
  /** Line when nothing is open yet. */
  emptyLine: ReactNode;
  /** Line when nothing is left sealed. */
  doneLine?: ReactNode;
  className?: string;
};

export function Register({
  title,
  titleHi,
  lead,
  entries,
  held,
  sealedStyle = 'chip',
  sealedLimit = 8,
  sealedCta,
  emptyLine,
  doneLine,
  className,
}: RegisterProps) {
  const { t } = useLang();
  const headId = useId();
  const listId = useId();
  const [all, setAll] = useState(false);
  const open = entries.filter((e) => held.has(e.item.id));
  const sealed = entries.filter((e) => !held.has(e.item.id));
  const shown = all ? sealed : sealed.slice(0, sealedLimit);
  const hidden = sealed.length - shown.length;
  return (
    <section className={cx('h-reg', className)} aria-labelledby={headId}>
      <header className="h-reg__head">
        <h2 className="h-reg__title" id={headId}>
          {titleHi ? (
            <span className="h-reg__titlehi" lang="hi">
              {titleHi}
            </span>
          ) : null}
          <span className="h-reg__titleen">{title}</span>
        </h2>
        <p className="h-reg__count h-mono">
          {open.length} {t('receipts collected', 'रसीदें मिलीं')}
        </p>
      </header>
      <p className="h-reg__lead">{lead}</p>
      {open.length ? (
        <ul className="h-reg__list">
          {open.map((e) => (
            <li key={e.item.id}>
              <OpenEntry entry={e} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="h-reg__empty">{emptyLine}</p>
      )}
      {sealed.length ? (
        <div className="h-reg__sealed">
          <p className="h-reg__sealedhead">
            <Lock size={16} strokeWidth={2.4} aria-hidden="true" />
            <span>{t('More to discover', 'और भी जानें')}</span>
            <span className="h-reg__sealednote">{t('Answer the card to open its entry.', 'कार्ड का जवाब दो, प्रविष्टि खुलेगी।')}</span>
          </p>
          <ul className={cx('h-reg__seals', sealedStyle === 'bubble' && 'h-reg__seals--bubbles')} id={listId}>
            {shown.map((e) => (
              <li key={e.item.id}>
                {sealedStyle === 'bubble' ? <SealedBubble entry={e} cta={sealedCta} /> : <SealedChip entry={e} cta={sealedCta} />}
              </li>
            ))}
          </ul>
          {hidden > 0 || all ? (
            <button type="button" className="h-reg__more" aria-expanded={all} aria-controls={listId} onClick={() => setAll((v) => !v)}>
              {all ? t('Show fewer', 'कम दिखाओ') : t('Show more sealed entries', 'और सील प्रविष्टियाँ दिखाओ')}
            </button>
          ) : null}
        </div>
      ) : doneLine ? (
        <p className="h-reg__done">{doneLine}</p>
      ) : null}
    </section>
  );
}

/** A sealed entry as a manila chip with a tape edge: kicker + the safe name. */
function SealedChip({ entry, cta }: { entry: RegisterEntry; cta: string }) {
  const name = entry.sealedTitle;
  return (
    <Link to={href.taster(entry.item.id)} className="h-reg__seal" aria-label={`${name ?? entry.kicker}, sealed. ${cta}.`}>
      <span className="h-reg__sealk" aria-hidden="true">
        {entry.kicker}
      </span>
      <span className="h-reg__sealt" aria-hidden="true">
        {name ?? 'Sealed card'}
      </span>
    </Link>
  );
}

/**
 * "Claim on trial · ruling sealed" — the neutral legal chip every unruled forward carries above its
 * words, so no screenshot of a docket or a file brief reads as the app circulating the claim (many name
 * real people). Shared with forwards.tsx's file brief.
 */
export function ClaimOnTrialChip() {
  const { isHi } = useLang();
  // Two unbreakable halves, so a narrow bubble wraps the chip at its "·" and nowhere else.
  const [a, b] = isHi ? ['दावा ·', 'फ़ैसला बंद'] : ['Claim on trial ·', 'ruling sealed'];
  return (
    <Chip kind="legal" icon={<Scale size={12} strokeWidth={2.6} />} className="h-reg__trial">
      <span className="h-reg__trialpart">{a}</span> <span className="h-reg__trialpart">{b}</span>
    </Chip>
  );
}

/** A sealed claim in a generic paper "forwarded" bubble (never a messenger's green, ticks or chrome). */
function SealedBubble({ entry, cta }: { entry: RegisterEntry; cta: string }) {
  // The link's name is its content: "Forwarded many times, Claim on trial · ruling sealed, <claim>, …".
  return (
    <Link to={href.taster(entry.item.id)} className="h-reg__bubble">
      <span className="h-reg__bubblehead">
        <span className="h-reg__fwd">
          <CornerUpRight size={14} strokeWidth={2.6} aria-hidden="true" />
          Forwarded many times
        </span>
        <ClaimOnTrialChip />
      </span>
      <span className="h-reg__claim">{entry.sealedTitle ?? entry.kicker}</span>
      <span className="h-reg__bubblecta">
        <span className="h-mono">{entry.kicker}</span>
        <span className="h-reg__ctaword">{cta} →</span>
      </span>
    </Link>
  );
}

function OpenEntry({ entry }: { entry: RegisterEntry }) {
  const { t, locale } = useLang();
  const { item } = entry;
  const status = item.status ?? null;
  return (
    <details className="h-reg__row">
      <summary className="h-reg__summary">
        <span className="h-reg__rowk h-mono">{entry.kicker}</span>
        <span className="h-reg__rowt">{entry.title}</span>
        <ChevronDown className="h-reg__chev" size={20} strokeWidth={2.4} aria-hidden="true" />
      </summary>
      <div className="h-reg__body">
        {entry.body}
        {status ? <LegalStatus status={status} asOf={item.asOf} /> : <p className="h-reg__asof">{asOfText(item.asOf, locale)}</p>}
        <p className="h-reg__source">
          <SourceChip kind={sourceKind(item)} />
          <a className="h-link h-reg__srclink" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
            <span>{item.sourceLabel}</span>
            <ExternalLink size={14} strokeWidth={2.4} aria-hidden="true" />
            <span className="h-sr">{t(' (opens the source in a new tab)', ' (स्रोत नए टैब में खुलेगा)')}</span>
          </a>
        </p>
      </div>
    </details>
  );
}

/** One labelled field inside an open entry ("Ruling", "Checked by"). */
export function RegisterField({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="h-reg__field">
      <span className="h-reg__fk">{k}</span>
      <div className="h-reg__fv">{children}</div>
    </div>
  );
}
