/**
 * screens/room/result.tsx — the match result (bible §11.12), for bot and friend duels.
 *
 * Text first: the verdict word (JEET / HAAR / BARABAR) and the true score render at once; TARAZU
 * (three/Tarazu, 2D fallback built in) mounts 250 ms later and settles to the TRUE angle. Then the true
 * margin line (only from result.reason / elapsedMs), the XP count-up with its breakdown, the Babu-rank
 * move in place (bot duels, "on this device"), the quests this match touched, and the round receipts
 * (each with its legal STATUS line verbatim + as of, when the item has one — charter §2.2).
 * Rematch is a tap, never queued by itself. The screen raises no toast or ceremony: the arena holds
 * the budget for 1.2 s after this renders, then the shell's watcher may show a label promotion.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ExternalLink, RotateCcw, Share2 } from 'lucide-react';
import { NumberCounter, useJuice } from '@/components/fx';
import { rankForPoints } from '@/lib/progression.mjs';
import { absoluteUrl, href } from '../../router';
import { ANONYMOUS, BABU_RANK_LADDER, BOT_NAME, babuRank, formatNumber, itemById, statusLine } from '../../data';
import { shareText, SHARE_FOOTER, type ShareOutcome } from '../../share';
import { useAppPlayer } from '../../shell/player';
import { sceneCapability } from '../../three/scene-host';
import { Tarazu } from '../../three/tarazu';
import { Button } from '../../ui/button';
import { LegalStatus } from '../../ui/chip';
import { useLang } from '../../ui/lang';
import { Stamp } from '../../ui/stamp';
import { Kicker } from '../../ui/text';
import { formatNameHi, formatOf } from '../duel/lib';
import { RoundHead } from './live';
import { SeatLine } from './receipt';
import {
  cancelReason,
  factIdOf,
  marginLine,
  other,
  settledRounds,
  verdictOf,
  xpForMatch,
  type LogEntry,
  type Room,
  type Seat,
} from './lib';
import './result.css';

/** What the profile looked like when the match was created, to show what this match changed. */
export type Baseline = { rankPoints: number; rankTier: string; quests: Record<string, number> };

type Quest = { id: string; label: string; target: number; progress: number; done: boolean };
type Progression = {
  log?: LogEntry[];
  rank?: { points: number; tier: string };
  quests?: { items?: Quest[] };
};

export function baselineOf(progression: unknown): Baseline {
  const p = (progression ?? {}) as Progression;
  const quests: Record<string, number> = {};
  for (const q of p.quests?.items ?? []) quests[q.id] = q.progress;
  return { rankPoints: p.rank?.points ?? 0, rankTier: p.rank?.tier ?? 'bronze', quests };
}

export type MatchResultProps = {
  room: Room;
  /** Display names by seat (the bot is always "Babu-Bot · BOT"). */
  names: readonly [string, string];
  kind: 'bot' | 'friend';
  baseline: Baseline | null;
  onRematch: () => void;
  /** The rematch button's state (a friend rematch waits for both taps). */
  rematch?: { busy?: boolean; disabled?: boolean; label?: string; note?: ReactNode };
  onExit: () => void;
  onSettings?: () => void;
  /** A local stop the room could not record (the guest lost the host; the deal did not match). */
  endReason?: string | null;
};

const WORDS = {
  win: { en: 'JEET', hi: 'जीत' },
  loss: { en: 'HAAR', hi: 'हार' },
  draw: { en: 'BARABAR', hi: 'बराबर' },
  cancelled: { en: 'MATCH STOPPED', hi: 'मैच रुका' },
} as const;

export function MatchResult({
  room,
  names,
  kind,
  baseline,
  onRematch,
  rematch,
  onExit,
  onSettings,
  endReason,
}: MatchResultProps) {
  const { t, isHi } = useLang();
  const juice = useJuice();
  const player = useAppPlayer();
  const progression = player.progression as Progression | undefined;
  const me = room.seat;
  const them = other(me);
  const verdict = endReason ? 'cancelled' : verdictOf(room);
  const mine = room.scores[me] ?? 0;
  const theirs = room.scores[them] ?? 0;
  const rival = names[them];
  const f = formatOf(room.config.mode);
  const [scale, setScale] = useState(false);
  const [shared, setShared] = useState<ShareOutcome | null>(null);
  const cued = useRef(false);

  // TARAZU 250 ms after the verdict text has rendered. The win/loss/draw cue plays ONCE, on settle
  // (bible §10): the 3D scale calls onSettled (its own weights thump and it gives the medium haptic,
  // so our cue is sound only); the 2D scale has nothing to wait for, so it cues as it mounts. If a 3D
  // load misses its deadline and falls back to 2D, the backstop timer still cues once.
  const scene3d = useMemo(() => sceneCapability().ok, []);
  const settleCue = useCallback(
    (haptic: boolean) => {
      if (cued.current || verdict === 'cancelled') return;
      cued.current = true;
      juice.sound(verdict);
      if (haptic) juice.haptic(verdict === 'win' ? 'success' : verdict === 'loss' ? 'medium' : 'light');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verdict],
  );
  const onSettled = useCallback(() => settleCue(false), [settleCue]);
  useEffect(() => {
    if (verdict === 'cancelled') return;
    const id = setTimeout(() => {
      setScale(true);
      if (!scene3d) settleCue(true);
    }, 250);
    const backstop = scene3d ? setTimeout(() => settleCue(true), 4500) : undefined;
    return () => {
      clearTimeout(id);
      if (backstop) clearTimeout(backstop);
    };
  }, [verdict, scene3d, settleCue]);

  const sub =
    verdict === 'win'
      ? t(`You won ${mine}–${theirs}`, `आप ${mine}–${theirs} से जीते`)
      : verdict === 'loss'
        ? t(`${rival} won ${theirs}–${mine}`, `${rival} ${theirs}–${mine} से जीता`)
        : verdict === 'draw'
          ? t(`Level at ${mine}–${theirs}`, `${mine}–${theirs} पर बराबर`)
          : cancelReason(endReason ?? room.reason, t);
  const copy =
    verdict === 'win'
      ? t('Jeet gaye. Receipts bhi aapki.', 'जीत गए। रसीदें भी आपकी।')
      : verdict === 'loss'
        ? t('Haar gaye. Receipts phir bhi aapke.', 'हार गए। रसीदें फिर भी आपकी।')
        : verdict === 'draw'
          ? kind === 'bot'
            ? t('Barabar. Babu bhi hairaan.', 'बराबर। बाबू भी हैरान।')
            : // Two humans: Babu isn't playing, so the line doesn't name him.
              t('Barabar. File dono ke naam.', 'बराबर। फ़ाइल दोनों के नाम।')
          : null;
  const margin = verdict === 'cancelled' ? null : marginLine(room, t);
  const xp = xpForMatch(progression?.log, room.id, t);
  const rounds = settledRounds(room);

  // Babu rank, in place (bot duels; a friend duel is casual — P2P_TRUST).
  const rank = progression?.rank;
  const rankDelta = baseline && rank ? rank.points - baseline.rankPoints : 0;
  const tierNow = rank ? rankForPoints(rank.points) : null;
  const promoted = !!(baseline && rank && rank.tier !== baseline.rankTier && rankDelta > 0);
  const nextTier = rank ? BABU_RANK_LADDER.find((x) => x.min > rank.points) : null;

  // Quests this match moved.
  const quests = (progression?.quests?.items ?? []).filter(
    (q) => baseline && q.progress > (baseline.quests[q.id] ?? 0),
  );

  const share = async () => {
    const vsBot = kind === 'bot';
    const fmt = f.name;
    // The bot travels with its label and its disclosure (N-rules: always BOT, random play disclosed).
    const line =
      verdict === 'win'
        ? vsBot
          ? `Beat ${BOT_NAME} ${mine}–${theirs} on HISAAB DO.`
          : `Won a ${fmt} duel ${mine}–${theirs} on HISAAB DO.`
        : verdict === 'loss'
          ? vsBot
            ? `Lost to ${BOT_NAME} ${mine}–${theirs} on HISAAB DO.`
            : `Lost a ${fmt} duel ${mine}–${theirs} on HISAAB DO.`
          : vsBot
            ? `Drew with ${BOT_NAME} ${mine}–${theirs} on HISAAB DO.`
            : `Drew a ${fmt} duel ${mine}–${theirs} on HISAAB DO.`;
    const disclosure = vsBot ? ' (The bot picks at random and can’t see the question.)' : '';
    setShared(
      await shareText([`${line}${disclosure} Har sawaal sourced.`, absoluteUrl(href.duel()), SHARE_FOOTER].join('\n')),
    );
  };
  const shareWord = !shared
    ? t('Share result', 'नतीजा शेयर करें')
    : shared.ok
      ? shared.method === 'clipboard'
        ? t('Copied ✓', 'कॉपी ✓')
        : t('Shared ✓', 'शेयर ✓')
      : shared.reason === 'cancelled'
        ? t('Share result', 'नतीजा शेयर करें')
        : t('Couldn’t share', 'शेयर नहीं हुआ');

  // The scale's pans print ≤ 14 characters: "You" for this seat; a nameless friend is "Friend".
  const pan = (seat: Seat) => {
    if (seat === me) return t('You', 'आप');
    const n = kind === 'friend' && names[seat] === ANONYMOUS ? t('Friend', 'दोस्त') : names[seat];
    return n.length > 14 ? `${n.slice(0, 13)}…` : n;
  };
  const tarazuNames: [string, string] = [pan(0), pan(1)];
  const winner = verdict === 'cancelled' ? null : (room.winner as Seat | null);

  return (
    <div className="h-result">
      <RoundHead room={room} names={names} onSettings={onSettings} sub={t('Final', 'अंतिम')} />
      <div className="h-result__grid">
        <section className="h-result__verdict" aria-labelledby="h-result-word">
          <Kicker lang={isHi ? 'hi' : undefined}>
            {t('MATCH RESULT', 'मैच का नतीजा')} ·{' '}
            {isHi ? <span lang="hi">{formatNameHi(f.mode)}</span> : f.name.toUpperCase()}
          </Kicker>
          <h1 className={`h-result__word h-result__word--${verdict}`} id="h-result-word">
            {isHi ? (
              <span lang="hi">{WORDS[verdict].hi}</span>
            ) : (
              <>
                <span className="h-result__wordhi" lang="hi">
                  {WORDS[verdict].hi}
                </span>
                <span className="h-result__worden">{WORDS[verdict].en}</span>
              </>
            )}
          </h1>
          <p className="h-result__sub" role="status">
            {sub}
          </p>
          {copy ? <p className="h-result__copy">{copy}</p> : null}
          {verdict !== 'cancelled' ? (
            <div className="h-result__scale">
              {scale ? (
                <Tarazu
                  scores={[room.scores[0] ?? 0, room.scores[1] ?? 0]}
                  names={tarazuNames}
                  winner={winner}
                  height={240}
                  onSettled={onSettled}
                />
              ) : (
                <div className="h-result__scalehold" aria-hidden="true" />
              )}
            </div>
          ) : null}
          {margin ? <p className="h-result__margin">{margin}</p> : null}
          {kind === 'bot' ? (
            <p className="h-result__bot">
              {t(
                "Babu-Bot · BOT picks at random and can't see the question.",
                'बाबू-बॉट · BOT बिना सवाल देखे, रैंडम चुनता है।',
              )}
            </p>
          ) : null}
        </section>

        <section
          className="h-result__side"
          aria-label={t('What this match filed', 'इस मैच ने क्या दर्ज किया')}
        >
          <div className="h-result__card">
            <h2 className="h-result__h2">{t('XP from this match', 'इस मैच का XP')}</h2>
            {xp ? (
              <>
                <p className="h-result__xp">
                  <span>+</span>
                  <NumberCounter
                    value={xp.total}
                    from={0}
                    duration={700}
                    format={(n) => formatNumber(Math.round(n))}
                    className="h-mono"
                  />
                  <span className="h-result__xpunit">XP</span>
                </p>
                <ul className="h-result__lines">
                  {xp.lines.map((l) => (
                    <li key={l.label}>
                      <span>{l.label}</span>
                      <span className="h-mono">+{formatNumber(l.xp)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="h-result__muted">
                {verdict === 'cancelled'
                  ? t('No XP: the match ended before a result.', 'कोई XP नहीं: मैच नतीजे से पहले ख़त्म हुआ।')
                  : t('Filing your receipts…', 'आपकी रसीदें दर्ज हो रही हैं…')}
              </p>
            )}
            {kind === 'bot' && xp && rank && tierNow && verdict !== 'cancelled' ? (
              <p className="h-result__rank">
                <span className="h-mono">{rankDelta >= 0 ? `+${rankDelta}` : `−${Math.abs(rankDelta)}`}</span>
                {' · '}
                {promoted
                  ? t(`Promoted to ${babuRank(rank.tier)}`, `${babuRank(rank.tier)} पर प्रमोशन`)
                  : babuRank(rank.tier)}{' '}
                {nextTier ? (
                  <span className="h-mono">
                    {rank.points - (BABU_RANK_LADDER.find((x) => x.id === rank.tier)?.min ?? 0)}/
                    {nextTier.min - (BABU_RANK_LADDER.find((x) => x.id === rank.tier)?.min ?? 0)}
                  </span>
                ) : null}
                <span className="h-result__muted">
                  {' '}
                  · {t('Babu rank, on this device', 'बाबू रैंक, इसी डिवाइस पर')}
                </span>
              </p>
            ) : null}
            {kind === 'friend' ? (
              <p className="h-result__muted">
                {t(
                  'Friend duels are casual: no coins, no ranking. Each device keeps its own record.',
                  'दोस्त से मुक़ाबला दोस्ताना है: कोई सिक्का नहीं, कोई रैंकिंग नहीं। हर डिवाइस अपना रिकॉर्ड रखता है।',
                )}
              </p>
            ) : null}
          </div>

          {quests.length ? (
            <div className="h-result__card">
              <h2 className="h-result__h2">{t('Aaj ke kaam', 'आज के काम')}</h2>
              <ul className="h-result__quests">
                {quests.map((q) => (
                  <li
                    key={q.id}
                    className={q.done ? 'h-result__quest h-result__quest--done' : 'h-result__quest'}
                  >
                    {q.done ? <Check aria-hidden="true" size={16} strokeWidth={3} /> : null}
                    <span>{q.label}</span>
                    <span className="h-mono">
                      {Math.min(q.progress, q.target)}/{q.target}
                    </span>
                    {q.done ? <span className="h-sr">{t('done', 'पूरा')}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {rounds.length ? (
            <div className="h-result__rounds">
              <h2 className="h-result__h2">{t('Round receipts', 'राउंड की रसीदें')}</h2>
              <ol className="h-result__swipe" aria-label={t('Round receipts', 'राउंड की रसीदें')}>
                {rounds.map((r) => {
                  const my = r.receipts?.[me] ?? null;
                  // Charter §2.2: a case answer never travels without its legal status, verbatim + as of.
                  const item = itemById(factIdOf(r.question));
                  const status = statusLine(item);
                  return (
                    <li key={r.id} className="h-result__mini">
                      <div className="h-result__minihead">
                        <Kicker as="span" lang={isHi ? 'hi' : undefined}>
                          {t(`ROUND ${r.index + 1}`, `राउंड ${r.index + 1}`)}
                        </Kicker>
                        <div className="h-stamp-stage">
                          <Stamp
                            kind={!my ? 'wait' : my.correct ? 'pass' : 'fail'}
                            seed={r.question.factId ?? r.id}
                            size="s"
                            text={!my ? 'PENDING' : my.correct ? 'SAHI' : 'GALAT'}
                          />
                        </div>
                      </div>
                      <p className="h-result__ministem" lang="en">
                        {r.question.question}
                      </p>
                      <p className="h-result__answer">
                        <Check aria-hidden="true" size={16} strokeWidth={3} />
                        <span className="h-sr">{t('Answer:', 'उत्तर:')} </span>
                        <span lang="en">{r.question.options[r.question.correctIndex ?? 0]}</span>
                      </p>
                      {item && status ? (
                        <LegalStatus status={status} asOf={item.asOf} className="h-result__legal" />
                      ) : null}
                      <ul className="h-result__miniseats">
                        <SeatLine name={t('You', 'आप')} receipt={my} bot={false} you />
                        <SeatLine
                          name={rival}
                          receipt={r.receipts?.[them] ?? null}
                          bot={room.players[them]?.kind === 'bot'}
                        />
                      </ul>
                      {r.question.sourceUrl ? (
                        <a
                          className="h-link h-link--tap h-result__src"
                          href={r.question.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {r.question.sourceLabel ?? t('Source', 'स्रोत')}
                          <ExternalLink aria-hidden="true" size={14} strokeWidth={2.4} />
                          <span className="h-sr">{t('(opens in a new tab)', '(नए टैब में)')}</span>
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          <nav className="h-result__more" aria-label={t('More', 'और')}>
            <a className="h-link h-link--tap" href={href.receipts()}>
              {t('All receipts', 'सारी रसीदें')}
            </a>
            <button type="button" className="h-link h-link--tap h-result__exit" onClick={onExit}>
              {t('Back to Muqabla', 'मुक़ाबले पर वापस')}
            </button>
          </nav>
        </section>
      </div>

      <div className="h-result__bar">
        <div className="h-result__barin">
          {rematch?.note ? (
            <p className="h-result__note" role="status">
              {rematch.note}
            </p>
          ) : null}
          {/* The share outcome is spoken too: the button's words change with no focus move. */}
          <p className="h-sr" aria-live="polite">
            {shared && !(shared.reason === 'cancelled') ? shareWord : ''}
          </p>
          <div className="h-result__actions">
            {verdict !== 'cancelled' ? (
              <Button
                variant="paper"
                size="s"
                icon={<Share2 size={18} strokeWidth={2.4} />}
                onClick={() => void share()}
              >
                {shareWord}
              </Button>
            ) : null}
            <Button
              variant="primary"
              icon={<RotateCcw size={20} strokeWidth={2.4} />}
              onClick={onRematch}
              disabled={rematch?.disabled || rematch?.busy}
              busy={rematch?.busy}
            >
              {rematch?.label ??
                (verdict === 'cancelled' ? t('New duel', 'नया मुक़ाबला') : t('Rematch', 'दोबारा मुक़ाबला'))}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
