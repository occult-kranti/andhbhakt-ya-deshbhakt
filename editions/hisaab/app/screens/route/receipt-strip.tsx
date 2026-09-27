/**
 * screens/route/receipt-strip.tsx — the finish's mini receipts (bible §11.13 "six mini receipts" and
 * "Share this file", the receipt-card carousel): one card per answer with its stamp, the stem, the
 * answer, the source and — when the item has one — the legal status VERBATIM with its as-of date.
 * Phones: a horizontal scroll-snap strip (the strip scrolls, never the page). 900px+: a grid.
 */
import { useId } from 'react';
import { Forward } from 'lucide-react';
import type { Card } from '../../../edition';
import { sourceKind, type BankItem } from '../../data';
import { shareReceipt, SHARE_CTA, type ReceiptShareVariant } from '../../share';
import { Button } from '../../ui/button';
import { LegalStatus, SourceChip } from '../../ui/chip';
import { useLang } from '../../ui/lang';
import { Stamp } from '../../ui/stamp';
import { Kicker } from '../../ui/text';
import { shareWords, useShareState } from './lib';
import './receipt-strip.css';

export type MiniEntry = {
  card: Pick<Card, 'factId' | 'question' | 'options' | 'correctIndex' | 'sourceUrl' | 'sourceLabel'>;
  item: BankItem | null;
  /** null = not answered. */
  right: boolean | null;
};

function MiniForward({ item, variant }: { item: BankItem; variant: ReceiptShareVariant }) {
  const { t } = useLang();
  const sharer = useShareState();
  return (
    <Button
      variant="paper"
      size="s"
      icon={<Forward size={18} strokeWidth={2.4} />}
      busy={sharer.state.status === 'busy'}
      onClick={() => void sharer.run(() => shareReceipt(item, variant))}
      className="h-rmini__share"
    >
      <span aria-live="polite">{shareWords(sharer.state, t(SHARE_CTA, 'फ़ॉरवर्ड करो — इसका सोर्स है'), t)}</span>
    </Button>
  );
}

export function ReceiptStrip({
  entries,
  title,
  lead,
  share,
}: {
  entries: readonly MiniEntry[];
  title: string;
  lead?: string;
  /** 'receipt' after a file; 'challenge' (no answer) for today's five, so nobody's day is spoilt. */
  share: ReceiptShareVariant;
}) {
  const { t } = useLang();
  const head = useId();
  return (
    <section className="h-strip" aria-labelledby={head}>
      <div className="h-strip__head">
        <h2 className="h-strip__title" id={head}>
          {title}
        </h2>
        {lead ? <p className="h-strip__lead">{lead}</p> : null}
      </div>
      <ol className="h-strip__list">
        {entries.map(({ card, item, right }, i) => (
          <li key={card.factId} className="h-rmini">
            <div className="h-rmini__head">
              <Kicker as="span">{`#${i + 1} · ${card.factId.toUpperCase()}`}</Kicker>
              {right === null ? (
                <Stamp kind="wait" seed={card.factId} size="s" text="PENDING" label={t('Not answered', 'जवाब नहीं')} />
              ) : (
                <Stamp
                  kind={right ? 'pass' : 'fail'}
                  seed={card.factId}
                  size="s"
                  text={right ? 'WAAH WAAH' : 'GALAT'}
                  label={right ? t('Correct', 'सही') : t('Wrong', 'ग़लत')}
                />
              )}
            </div>
            <p className="h-rmini__stem" lang="en">
              {card.question}
            </p>
            <p className="h-rmini__ans">
              <span className="h-rmini__k">{t('ANSWER', 'जवाब')}</span>
              <span lang="en">{card.options[card.correctIndex]}</span>
            </p>
            <p className="h-rmini__src">
              <SourceChip kind={sourceKind(card)} />
              <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer" className="h-rmini__link">
                {card.sourceLabel}
                <span className="h-sr"> {t('(opens in a new tab)', '(नए टैब में)')}</span>
              </a>
            </p>
            {item?.status ? <LegalStatus status={item.status} asOf={item.asOf} /> : null}
            {item ? <MiniForward item={item} variant={share} /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
