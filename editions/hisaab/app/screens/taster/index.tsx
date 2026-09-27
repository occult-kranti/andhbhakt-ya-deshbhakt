/**
 * screens/taster/index.tsx — #/q/:id (also #q=<id>), the one-card taster: the landing page of every
 * forwarded receipt card (design bible §8.4 referral loop; the card is §11.7's untimed card).
 *
 *   forwarded card → THIS: the question already on screen (no account, no name) → the receipt →
 *   the label reveal → "Open today's file" / "Duel the friend who sent this"
 *
 * The options stay in the bank's order, so they match the A–D of the forwarded text. The answer is
 * filed like any untimed card (`practice`, one round id per item: a link opened twice never pays
 * twice), so the receipt lands in the Vault and the first one reveals the starting label inline —
 * not a ceremony. Quiet: nothing moves before the lock; toasts wait until the card is answered.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Swords } from 'lucide-react';
import { standing, type Card } from '../../../edition';
import { useHoldToasts } from '../../budget';
import { bandProgress, FIRST_LABEL_NOTE, FIRST_LABEL_NOTE_HI, goalCopy, itemById, labelDisplay, labelLine, type BankItem } from '../../data';
import { goBack, href, type ScreenProps } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { useAppPlayer } from '../../shell/player';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';
import { Meter } from '../../ui/meter';
import { InlineNote, Page, ScreenHeader, ErrorState } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { Kicker } from '../../ui/text';
import { CardResult, PlayHeader, QuestionCard, revealResult, useLockCues } from '../route/card';
import {
  cardKicker,
  choiceOf,
  receiptCount,
  receiptOrdinal,
  roundsById,
  tasterRoundId,
  xpForRound,
  type Journal,
  type Progression,
} from '../route/lib';
import './taster.css';

export default function TasterScreen({ route }: ScreenProps) {
  const item = itemById(route.params.id ?? '');
  if (!item) return <MissingCard />;
  return <Taster key={item.id} item={item} />;
}

function MissingCard() {
  const { t } = useLang();
  useScreenTitle(t('Card missing', 'कार्ड गायब'));
  return (
    <Page screen="taster-missing" width="read">
      <ScreenHeader kicker="F.No. Q/——" titleHi="एक सवाल" title={t('One question', 'एक सवाल')} />
      <ErrorState detail={t('This card is not in the bank any more — it may have been corrected or retired. Corrections are logged on the Rules page.', 'यह कार्ड अब बैंक में नहीं है।')} />
      <div className="h-taster__next">
        <Button variant="primary" block href={href.aaj()}>
          {t("Open today's file", 'आज की फ़ाइल खोलो')}
        </Button>
        <Button variant="ghost" size="s" href={href.rules('corrections')}>
          {t('See corrections', 'सुधार देखो')}
        </Button>
      </div>
    </Page>
  );
}

/** The bank item as a playable card, options in the bank's own order (the share text's A–D). */
const asCard = (q: BankItem): Card => ({
  factId: q.id,
  domain: q.domain,
  topic: q.topic,
  subtopic: q.subtopic,
  difficulty: q.difficulty,
  question: q.question,
  options: [...q.options],
  correctIndex: q.correctIndex,
  explanation: q.explanation,
  sourceUrl: q.sourceUrl,
  sourceLabel: q.sourceLabel,
});

/**
 * True when this page is the first thing opened in the tab (a forwarded link), so "the friend who sent
 * this" is the right words; inside the app the same button reads "Duel a friend".
 */
function openedFromLink(): boolean {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!nav?.name) return false;
    const hash = new URL(nav.name).hash;
    return !!hash && hash === location.hash;
  } catch {
    return false;
  }
}

function Taster({ item }: { item: BankItem }) {
  const player = useAppPlayer();
  const { t, isHi } = useLang();
  const cues = useLockCues();
  useScreenTitle(t('One question', 'एक सवाल'));

  const card = useMemo(() => asCard(item), [item]);
  const roundId = tasterRoundId(item.id);
  const profile = player.profile as { journal?: Journal; progression?: Progression } | null;
  const journal = profile?.journal;
  const rounds = useMemo(() => roundsById(journal), [journal]);
  const stored = rounds.get(roundId);
  const storedChoice = choiceOf(stored, card.options);

  const [pending, setPending] = useState<number | null>(null);
  const [pendingMs, setPendingMs] = useState<number | null>(null);
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [landing] = useState(openedFromLink);
  // Receipts held before this card, read once the profile has loaded: 0 → this is the first receipt.
  const [before, setBefore] = useState<number | null>(null);
  useEffect(() => {
    if (player.loaded && before === null) setBefore(receiptCount(journal));
  }, [player.loaded, before, journal]);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (fresh) revealResult(resultRef.current);
  }, [fresh]);

  const choice = storedChoice ?? pending;
  const answered = choice !== null;
  useHoldToasts(player.loaded && !answered);

  const choose = async (i: number, elapsedMs: number) => {
    if (answered || busy || !player.loaded) return;
    setPending(i);
    setPendingMs(elapsedMs);
    setFresh(true);
    cues(i === card.correctIndex);
    setBusy(true);
    try {
      await player.dispatch({ type: 'practice', fact: card, choice: i, elapsedMs, roundId });
    } catch {
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  if (!player.loaded)
    return (
      <Page screen="taster" className="h-play">
        <Skeleton lines={6} label={t('Opening the card', 'कार्ड खुल रहा है')} />
      </Page>
    );

  const firstReceipt = fresh && before === 0;
  return (
    <Page screen="taster" className="h-play h-taster">
      <PlayHeader
        fno={`F.No. Q/${item.id.toUpperCase()}`}
        title={t('One question', 'एक सवाल')}
        titleHi={isHi ? undefined : 'एक सवाल'}
        index={0}
        total={1}
        segments={[answered ? 'done' : 'current']}
        sub={t('One question. One receipt. No account.', 'एक सवाल। एक रसीद। कोई अकाउंट नहीं।')}
        closeHref={href.home()}
        closeLabel={t('Close', 'बंद करो')}
        onClose={() => goBack(href.home())}
      />
      {!player.persistent && player.storageError ? <InlineNote tone="wait">{player.storageError}</InlineNote> : null}
      <div className="h-play__grid">
        <div className="h-play__main">
          <QuestionCard
            card={card}
            kicker={cardKicker(card, item, isHi)}
            chosen={choice}
            revealed={answered}
            onChoose={(i, ms) => void choose(i, ms)}
            elapsedMs={stored?.elapsedMs ?? pendingMs}
            busy={busy && !answered}
          />
        </div>
        <div className="h-play__side">
          {choice !== null ? (
            <>
              <CardResult
                ref={resultRef}
                card={card}
                item={item}
                choice={choice}
                elapsedMs={stored?.elapsedMs ?? pendingMs}
                fresh={fresh}
                receiptNo={stored ? receiptOrdinal(journal, item.id) : null}
                xp={stored ? xpForRound(rounds, profile?.progression?.log, roundId) : null}
                share="receipt"
              />
              {stored && !fresh ? (
                <p className="h-taster__again">
                  {t('You answered this card before. The receipt is already in your Vault.', 'आप यह कार्ड पहले कर चुके हो। रसीद वॉल्ट में है।')}
                </p>
              ) : null}
              <LabelReveal xp={profile?.progression?.xp ?? 0} first={firstReceipt} />
              <div className="h-taster__next">
                <Button variant="primary" block href={href.aaj()}>
                  {t("Open today's file", 'आज की फ़ाइल खोलो')}
                </Button>
                <Button variant="paper" block href={href.friend()} icon={<Swords size={20} strokeWidth={2.4} />}>
                  {landing ? t('Duel the friend who sent this', 'भेजने वाले दोस्त से मुक़ाबला') : t('Duel a friend', 'दोस्त से मुक़ाबला')}
                </Button>
                {!landing ? (
                  <Button variant="ghost" size="s" icon={<ArrowLeft size={18} strokeWidth={2.4} />} onClick={() => goBack(href.home())}>
                    {t('Back', 'वापस')}
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="h-play__wait" aria-hidden="true">
              <Kicker>RECEIPT</Kicker>
              <p>{t('Answer first. The receipt — source, status, the other side — prints here.', 'पहले जवाब। फिर रसीद यहाँ छपेगी।')}</p>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

/**
 * The label reveal after the taster's receipt (bible §8.4, §11.1): inline, never a ceremony. The first
 * receipt ever says where everyone starts; otherwise the player's own label, updated in place.
 */
function LabelReveal({ xp, first }: { xp: number; first: boolean }) {
  const { t, isHi } = useLang();
  const s = standing(xp);
  const l = labelDisplay(s.band);
  const meter = bandProgress(xp);
  return (
    <section className="h-reveal" aria-labelledby="h-reveal-title">
      <Kicker>{first ? t('YOUR FIRST RECEIPT', 'आपकी पहली रसीद') : t(`YOU ARE · LEVEL ${s.level}`, `आप हो · लेवल ${s.level}`)}</Kicker>
      <h2 className="h-reveal__title" id="h-reveal-title">
        <span className="h-reveal__lead">{first ? t('You start as', 'आपकी शुरुआत') : t('Your label', 'आपका लेबल')}</span>
        <span className="h-reveal__hi" lang="hi">
          {l.hi}
        </span>
        <span className="h-reveal__en">
          {l.en}
          {l.aside ? (
            <span className="h-reveal__aside" lang={isHi && l.asideHi ? 'hi' : undefined}>
              {' '}
              {isHi && l.asideHi ? l.asideHi : l.aside}
            </span>
          ) : null}
        </span>
      </h2>
      <p className="h-reveal__line" lang={isHi ? 'hi' : undefined}>
        {labelLine(l, isHi)}
      </p>
      {s.band === 0 ? (
        <p className="h-reveal__note" lang={isHi ? 'hi' : undefined}>
          {t(FIRST_LABEL_NOTE, FIRST_LABEL_NOTE_HI)}
        </p>
      ) : null}
      <Meter
        value={meter.value}
        max={meter.max}
        ticks={5}
        label={t('Progress to the next label', 'अगले लेबल तक')}
        valueText={`Level ${s.level}. ${goalCopy(xp)}`}
        copy={goalCopy(xp, isHi ? 'hi' : 'en')}
      />
    </section>
  );
}
