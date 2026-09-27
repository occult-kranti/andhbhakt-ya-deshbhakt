/**
 * screens/room/receipt.tsx — the round receipt between rounds (bible §11.11).
 *
 * Order (≤ 900 ms): option states → STAMP (SAHI · APPROVED / GALAT · OBJECTION / PENDING "No answer")
 * → the round line, only when true → the receipt prints (RECEIPT # · XP with its breakdown, SOURCE,
 * STATUS with as-of, OTHER SIDE, GOVT THEN) → the noting, collapsed ("Read the noting").
 * A Surprise Audit is announced here — this round's, and the NEXT round's before it starts — never on
 * the question card. Nothing funny happens inside the receipt. No toasts (the arena holds them).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { useJuice } from '@/components/fx';
import { itemById } from '../../data';
import { useAppPlayer } from '../../shell/player';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { useLang } from '../../ui/lang';
import { NotingSheet } from '../../ui/noting-sheet';
import { OPTION_SLOTS, OptionList, OptionShape } from '../../ui/option';
import { Receipt } from '../../ui/receipt';
import { Stamp } from '../../ui/stamp';
import { sectorName } from '../duel/lib';
import { RoundHead } from './live';
import {
  auditOf,
  factIdOf,
  other,
  receiptOrdinal,
  roundIdFor,
  roundLine,
  seconds,
  xpForRound,
  type DoneRound,
  type LogEntry,
  type Room,
  type SeatReceipt,
} from './lib';
import './receipt.css';

/** The other side's answer, when a bank item carries it as its own field (bank lanes may add it). */
function otherSideOf(item: unknown): string | undefined {
  const v = (item as { otherSide?: unknown } | null)?.otherSide;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** "B ◆" — the letter and shape twin of a pick. */
export function PickMark({ choice }: { choice: number }) {
  const { isHi } = useLang();
  const slot = OPTION_SLOTS[choice];
  if (!slot) return null;
  return (
    <span className="h-pick">
      <span className="h-pick__letter" lang={isHi ? 'hi' : undefined}>
        {isHi ? slot.letterHi : slot.letter}
      </span>
      <OptionShape index={choice} size={14} />
    </span>
  );
}

/** One seat's line: "You: B ◆ · right · 2.31 s". */
export function SeatLine({
  name,
  receipt,
  bot,
  you,
}: {
  name: string;
  receipt: SeatReceipt;
  bot: boolean;
  you?: boolean;
}) {
  const { t } = useLang();
  return (
    <li className="h-seatline">
      <span className="h-seatline__name">{name}</span>
      {receipt ? (
        <>
          <PickMark choice={receipt.choice} />
          <span
            className={
              receipt.correct ? 'h-seatline__v h-seatline__v--pass' : 'h-seatline__v h-seatline__v--fail'
            }
          >
            {receipt.correct ? t('✓ right', '✓ सही') : t('✕ wrong', '✕ ग़लत')}
          </span>
          <span className="h-seatline__ms h-mono">{seconds(receipt.elapsedMs)}</span>
          {bot ? (
            <span className="h-seatline__note">{t('scheduled · picks at random', 'तय समय · बिना पढ़े')}</span>
          ) : null}
        </>
      ) : (
        <span className="h-seatline__v h-seatline__v--wait">
          {you ? t('⏳ no answer in time', '⏳ समय पर जवाब नहीं') : t('⏳ no answer', '⏳ कोई जवाब नहीं')}
        </span>
      )}
    </li>
  );
}

export type RoundReceiptProps = {
  room: Room;
  round: DoneRound;
  names: readonly [string, string];
  kind: 'bot' | 'friend';
  /** The match is settled after this round: the primary opens the verdict. */
  final: boolean;
  onNext: () => void;
  busy?: boolean;
  onSettings?: () => void;
  banner?: ReactNode;
  /**
   * Hands the round's one polite sentence (verdict, the answer, the score) to the arena's standing
   * live region, once, as the receipt mounts (a region mounted already holding its words is not read).
   */
  onSay?: (text: string) => void;
};

export function RoundReceipt({
  room,
  round,
  names,
  kind,
  final,
  onNext,
  busy,
  onSettings,
  banner,
  onSay,
}: RoundReceiptProps) {
  const { t, isHi } = useLang();
  const juice = useJuice();
  const player = useAppPlayer();
  const me = room.seat;
  const them = other(me);
  const q = round.question;
  const factId = factIdOf(q);
  const item = itemById(factId);
  const mine = round.receipts?.[me] ?? null;
  const verdict: 'pass' | 'fail' | 'wait' = !mine ? 'wait' : mine.correct ? 'pass' : 'fail';
  const line = roundLine(round, me, names[them], t);
  // One polite announcement for the round (bible §7): verdict, the answer, the score.
  const mineScore = room.scores[me] ?? 0;
  const theirScore = room.scores[them] ?? 0;
  const key = q.correctIndex !== undefined ? q.options[q.correctIndex] : '';
  const scoreWords =
    mineScore > theirScore
      ? t(`You lead ${mineScore}–${theirScore}.`, `आप ${mineScore}–${theirScore} से आगे।`)
      : mineScore < theirScore
        ? t(
            `${names[them]} leads ${theirScore}–${mineScore}.`,
            `${names[them]} ${theirScore}–${mineScore} से आगे।`,
          )
        : t(`Level at ${mineScore}–${theirScore}.`, `${mineScore}–${theirScore} पर बराबर।`);
  const said = [
    !mine ? t('No answer.', 'कोई जवाब नहीं।') : mine.correct ? t('Correct.', 'सही।') : t('Wrong.', 'ग़लत।'),
    key ? `${t('Answer', 'उत्तर')}: ${key}.` : '',
    line ?? '',
    scoreWords,
  ]
    .filter(Boolean)
    .join(' ');
  const audit = auditOf(round.id);
  const nextAudit = final ? 1 : auditOf(roundIdFor(room.id, round.index + 1));
  const log = (player.progression as { log?: LogEntry[] } | undefined)?.log;
  const xp = xpForRound(log, room.id, round.index, !!mine?.correct, kind === 'bot');
  const receiptNo = receiptOrdinal(player.journal as never, factId);
  const played = useRef(false);

  // Once per round: the stamp's thump and its verdict cue (never before the result — this screen only
  // exists after it).
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    onSay?.(said);
    juice.sound('stamp');
    if (verdict === 'pass') {
      juice.sound('correct');
      juice.haptic('success');
    } else if (verdict === 'fail') {
      juice.sound('wrong');
      juice.haptic('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meReady = !!room.players[me]?.ready;
  const theyReady = !!room.players[them]?.ready;
  const primary = final
    ? t('See the verdict', 'फ़ैसला देखें')
    : kind === 'friend' && meReady
      ? t('Ready · waiting…', 'तैयार · इंतज़ार…')
      : t('Next round', 'अगला राउंड');
  const copy =
    verdict === 'pass'
      ? 'Receipt mil gayi.'
      : verdict === 'fail'
        ? 'Galat. Par receipt toh le lo.'
        : 'File pending. Clock ne stamp laga diya.';
  const copyHi =
    verdict === 'pass'
      ? 'रसीद मिल गई।'
      : verdict === 'fail'
        ? 'ग़लत। पर रसीद तो ले लो।'
        : 'फ़ाइल पेंडिंग। घड़ी ने ठप्पा लगा दिया।';

  return (
    <div className="h-rreceipt">
      <RoundHead
        room={room}
        names={names}
        onSettings={onSettings}
        sub={t(`Round ${round.index + 1} · receipt`, `राउंड ${round.index + 1} · रसीद`)}
      />
      {banner}
      <div className="h-rreceipt__grid">
        <section className="h-rreceipt__answers" aria-labelledby={`h-rr-stem-${round.id}`}>
          <p className="h-rreceipt__kicker">
            {sectorName(q.topic, isHi)}
            {q.subtopic ? ` · ${q.subtopic}` : ''}
          </p>
          <h1 className="h-rreceipt__stem" id={`h-rr-stem-${round.id}`} lang="en">
            {q.question}
          </h1>
          <OptionList
            options={q.options}
            chosen={mine?.choice ?? null}
            correctIndex={q.correctIndex ?? null}
            disabled
            keys={false}
            label={t('Answers and the key', 'जवाब और सही उत्तर')}
          />
          <ul className="h-rreceipt__seats" aria-label={t('Who picked what', 'किसने क्या चुना')}>
            <SeatLine name={t('You', 'आप')} receipt={mine} bot={false} you />
            <SeatLine
              name={names[them]}
              receipt={round.receipts?.[them] ?? null}
              bot={room.players[them]?.kind === 'bot'}
            />
          </ul>
        </section>

        <section className="h-rreceipt__evidence" aria-label={t('The receipt', 'रसीद')}>
          {/* Focus lands here when the receipt opens (the arena's [data-autofocus]), not on the stem:
              the player hears the verdict, not the question again. */}
          <div
            className="h-rreceipt__verdict"
            role="group"
            aria-labelledby={`h-rr-verdict-${round.id}`}
            tabIndex={-1}
            data-autofocus=""
          >
            <h2 className="h-sr" id={`h-rr-verdict-${round.id}`}>
              {t(
                `Round ${round.index + 1}: ${verdict === 'pass' ? 'correct' : verdict === 'fail' ? 'wrong' : 'no answer'}`,
                `राउंड ${round.index + 1}: ${verdict === 'pass' ? 'सही' : verdict === 'fail' ? 'ग़लत' : 'कोई जवाब नहीं'}`,
              )}
            </h2>
            <div className="h-stamp-stage h-rreceipt__stage">
              <Stamp
                kind={verdict}
                seed={factId ?? round.id}
                text={verdict === 'wait' ? 'PENDING · NO ANSWER' : undefined}
                label={
                  verdict === 'pass'
                    ? t('Correct', 'सही')
                    : verdict === 'fail'
                      ? t('Wrong', 'ग़लत')
                      : t('No answer', 'कोई जवाब नहीं')
                }
                animate
              />
            </div>
            <p className="h-rreceipt__copy">{isHi ? <span lang="hi">{copyHi}</span> : copy}</p>
            {line ? <p className="h-rreceipt__line">{line}</p> : null}
          </div>

          {audit > 1 || nextAudit > 1 ? (
            <div className="h-rreceipt__audits">
              {audit > 1 ? (
                <Chip kind="kind" icon={<Sparkles size={14} strokeWidth={2.4} />} className="h-audit">
                  {t(
                    `Surprise Audit ×${audit} · base answer + separate bonus`,
                    `सरप्राइज़ ऑडिट ×${audit} · जवाब XP + अलग बोनस`,
                  )}
                </Chip>
              ) : null}
              {nextAudit > 1 ? (
                <Chip kind="kind" icon={<Sparkles size={14} strokeWidth={2.4} />} className="h-audit">
                  {t(
                    `Next round: Surprise Audit ×${nextAudit} · separate bonus`,
                    `अगला राउंड: सरप्राइज़ ऑडिट ×${nextAudit} · अलग बोनस`,
                  )}
                </Chip>
              ) : null}
            </div>
          ) : null}

          <Receipt
            item={item}
            otherSide={otherSideOf(item)}
            receiptNo={receiptNo ?? undefined}
            xp={xp?.xp}
            xpNote={xp ? xp.parts.join(' · ') : t('XP is being filed…', 'XP दर्ज हो रहा है…')}
            printing
            label={t(`Receipt for round ${round.index + 1}`, `राउंड ${round.index + 1} की रसीद`)}
          />
          {!item && q.sourceUrl ? (
            <p className="h-rreceipt__src">
              <a className="h-link" href={q.sourceUrl} target="_blank" rel="noopener noreferrer">
                {q.sourceLabel}
              </a>
            </p>
          ) : null}
          {q.explanation ? (
            <NotingSheet collapsible summary={t('Read the noting', 'नोटिंग पढ़ें')}>
              <p lang="en">{q.explanation}</p>
            </NotingSheet>
          ) : null}
        </section>
      </div>

      <div className="h-rreceipt__bar">
        <div className="h-rreceipt__barin">
          {kind === 'friend' && !final ? (
            <p className="h-rreceipt__ready" role="status">
              {theyReady
                ? t(`${names[them]} is ready.`, `${names[them]} तैयार है।`)
                : t(`${names[them]} hasn't tapped Next yet.`, `${names[them]} ने अभी Next नहीं दबाया।`)}
            </p>
          ) : null}
          <div className="h-rreceipt__actions">
            {q.sourceUrl ? (
              <Button
                variant="paper"
                size="s"
                href={q.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                icon={<ExternalLink size={18} strokeWidth={2.4} />}
              >
                {t('Open source', 'स्रोत खोलें')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              onClick={onNext}
              disabled={busy || (kind === 'friend' && !final && meReady)}
              busy={busy}
            >
              {primary}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
