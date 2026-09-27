/**
 * screens/pass/index.tsx — Pass & Play: two players, one phone, untimed (bible §11.10; ENGINE §12).
 *
 * Driven entirely by the engine's pure reducer (p2p/pass-and-play.mjs): startPassAndPlay →
 * reducePassAndPlay({ready | answer | next}) → passAndPlayView, which withholds the key and the other
 * seat's pick until both have answered. Phases on screen:
 *
 *   pass     full-screen hand-over cover: "Hand the phone to Riya. Don't peek." — the question and
 *            the first pick are not in the DOM; the budget is quiet (useQuietRound)
 *   answer   the question for the seat holding the phone; first tap locks, no timer
 *   reveal   both picks, the key, the round's verdict (the engine's roundVerdict with equal times:
 *            both right = a shared round), the receipt and the noting
 *   complete the verdict text first, TARAZU 250 ms later; Play again is a tap
 *
 * Nothing is written to a profile: two people share one device (ENGINE §12).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useJuice } from '@/components/fx';
import { passAndPlayView, reducePassAndPlay, startPassAndPlay } from '../../../p2p/pass-and-play.mjs';
import { useHoldToasts, useQuietRound } from '../../budget';
import { impersonatesBot, itemById, statusLine } from '../../data';
import { href, navigate, type ScreenProps } from '../../router';
import { useChrome, useScreenTitle } from '../../shell/chrome';
import { sceneCapability } from '../../three/scene-host';
import { Tarazu } from '../../three/tarazu';
import { Button } from '../../ui/button';
import { BrandName } from '../../ui/brand';
import { LegalStatus } from '../../ui/chip';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { NotingSheet } from '../../ui/noting-sheet';
import { Stopwatch } from '../../ui/stopwatch';
import { createStopwatch } from '../../../engine/scoring.mjs';
import { OptionList } from '../../ui/option';
import { ErrorState, Page, ScreenHeader } from '../../ui/page';
import { Receipt } from '../../ui/receipt';
import { Stamp } from '../../ui/stamp';
import { Kicker } from '../../ui/text';
import { MatchSettings, MatchSettingsButton } from '../room/match-settings';
import { PickMark } from '../room/receipt';
import {
  FORMATS,
  formatLine,
  formatNameHi,
  formatOf,
  NAME_LIMIT,
  parseMode,
  parseTopic,
  roundOf,
  sectorName,
} from '../duel/lib';
import type { DuelMode } from '../room/lib';
import '../room/live.css';
import './pass.css';

type Answer = { choice: number; correct: boolean; elapsedMs: number } | { locked: true } | null;
type DeckCard = {
  id: string;
  topic: string;
  subtopic?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceUrl: string;
  sourceLabel: string;
};
type PassRound = {
  index: number;
  question: DeckCard;
  answers: ({ choice: number; correct: boolean; elapsedMs: number } | null)[];
  result: { winner: 0 | 1 | null; reason: string };
};
/** The reducer's state (p2p/pass-and-play.mjs), typed for this screen. */
type PassState = Omit<ReturnType<typeof startPassAndPlay>, 'rounds' | 'deck'> & {
  deck: DeckCard[];
  rounds: PassRound[];
  decided?: boolean;
};
type View = {
  phase: 'pass' | 'answer' | 'reveal' | 'complete';
  mode: DuelMode;
  names: [string, string];
  turn: 0 | 1;
  holder: string;
  roundIndex: number;
  rounds: number;
  scores: [number, number];
  question: {
    topic: string;
    subtopic?: string;
    question: string;
    options: string[];
    correctIndex?: number;
    explanation?: string;
    sourceUrl?: string;
    sourceLabel?: string;
  } | null;
  answers: Answer[];
  result: { winner: 0 | 1 | null; reason: string } | null;
  winner: 0 | 1 | null;
};

export default function PassScreen({ route }: ScreenProps) {
  const { t } = useLang();
  useScreenTitle(t('Pass & Play', 'पास एंड प्ले'));
  const [mode, setMode] = useState<DuelMode>(() => parseMode(route.query.mode));
  const topic = parseTopic(route.query.topic, mode);
  const [names, setNames] = useState<[string, string]>(['', '']);
  const [game, setGame] = useState<PassState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    try {
      setError(null);
      // Blank names become "Player 1" / "Player 2" in the player's language (nothing is pre-filled).
      // A typed name that would pass for the bot ('Babu-Bot · BOT') is a Player n too: no bot plays here.
      const who = names.map((n, i) => (!impersonatesBot(n) && n.trim()) || t(`Player ${i + 1}`, `खिलाड़ी ${i + 1}`)) as [
        string,
        string,
      ];
      setGame(
        startPassAndPlay({
          mode,
          names: who,
          filters: topic === 'all' ? {} : { topic },
        }) as unknown as PassState,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!game)
    return (
      <PassSetup
        mode={mode}
        setMode={setMode}
        topic={topic}
        names={names}
        setNames={setNames}
        onStart={start}
        error={error}
      />
    );
  return (
    <PassGame
      key={String(game.deck[0]?.id)}
      game={game}
      setGame={setGame}
      onAgain={start}
      onChange={() => setGame(null)}
    />
  );
}

// ---- who's playing -----------------------------------------------------------------------------------------

function PassSetup({
  mode,
  setMode,
  topic,
  names,
  setNames,
  onStart,
  error,
}: {
  mode: DuelMode;
  setMode: (m: DuelMode) => void;
  topic: string;
  names: [string, string];
  setNames: (n: [string, string]) => void;
  onStart: () => void;
  error: string | null;
}) {
  const { t, isHi } = useLang();
  useChrome('full');
  return (
    <Page screen="pass-setup" width="read" className="h-pass">
      <ScreenHeader
        kicker="F.No. P&P/2026"
        titleHi="पास एंड प्ले"
        title="Pass & Play"
        lead={t(
          'Two players, one phone, no deadline. Times are shown for this game only; no profile XP.',
          'दो खिलाड़ी, एक फ़ोन, कोई समय सीमा नहीं। समय सिर्फ़ इस खेल में दिखेगा; प्रोफ़ाइल XP नहीं।',
        )}
      />
      <form
        className="h-pass__card"
        onSubmit={(e) => {
          e.preventDefault();
          onStart();
        }}
      >
        <fieldset className="h-pass__names">
          <legend className="h-pass__label">
            {t('Who is playing? (optional)', 'कौन खेल रहा है? (वैकल्पिक)')}
          </legend>
          {[0, 1].map((i) => (
            <div key={i} className="h-pass__field">
              <label className="h-pass__sub" htmlFor={`h-pass-name-${i}`}>
                {t(`Player ${i + 1}`, `खिलाड़ी ${i + 1}`)}
              </label>
              <input
                id={`h-pass-name-${i}`}
                className="h-pass__input"
                value={names[i]}
                maxLength={NAME_LIMIT}
                placeholder={`Player ${i + 1}`}
                autoComplete="off"
                onChange={(e) => setNames(i === 0 ? [e.target.value, names[1]] : [names[0], e.target.value])}
              />
            </div>
          ))}
        </fieldset>
        <fieldset className="h-pass__fmts">
          <legend className="h-pass__label">{t('Format', 'फ़ॉर्मैट')}</legend>
          {FORMATS.map((x) => (
            <label key={x.mode} className={cx('h-pass__fmt', mode === x.mode && 'h-pass__fmt--on')}>
              <input
                className="h-pass__fmtin"
                type="radio"
                name="h-pass-mode"
                checked={mode === x.mode}
                onChange={() => setMode(x.mode as DuelMode)}
              />
              <span className="h-pass__fmtname">
                {isHi ? <span lang="hi">{formatNameHi(x.mode as DuelMode)}</span> : x.name}
              </span>
              <span className="h-pass__fmtnums">{formatLine(x.mode as DuelMode, true, isHi)}</span>
            </label>
          ))}
        </fieldset>
        <p className="h-pass__muted">
          {t('Topic', 'विषय')}: {topic === 'all' ? t('Mixed', 'मिला-जुला') : sectorName(topic, isHi)} ·{' '}
          <a className="h-link" href={href.duel({ vs: 'pass', mode })}>
            {t('change in Muqabla', 'मुक़ाबला में बदलें')}
          </a>
        </p>
        <p className="h-pass__muted">
          {t(
            'Each round: one of you answers, hands the phone over, the other answers. Both right is a shared round — no point.',
            'हर राउंड: एक जवाब दे, फ़ोन आगे करे, दूसरा जवाब दे। दोनों सही तो साझा राउंड — कोई अंक नहीं।',
          )}
        </p>
        {error ? <ErrorState title={error} /> : null}
        <Button variant="primary" type="submit" block>
          {t('Start pass & play', 'पास एंड प्ले शुरू करें')}
        </Button>
      </form>
    </Page>
  );
}

// ---- the game ----------------------------------------------------------------------------------------------

function PassGame({
  game,
  setGame,
  onAgain,
  onChange,
}: {
  game: PassState;
  setGame: (s: PassState) => void;
  onAgain: () => void;
  onChange: () => void;
}) {
  const { t, isHi } = useLang();
  const juice = useJuice();
  const view = passAndPlayView(game) as unknown as View;
  const [asking, setAsking] = useState(false);
  const clock = useMemo(() => createStopwatch(), [view.roundIndex, view.turn]);
  useLayoutEffect(() => {
    if (view.phase !== 'answer') return;
    let b = 0;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => clock.start()); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [clock, view.phase]);
  const act = (a: { type: 'ready' } | { type: 'answer'; choice: number; answerTimeMs?: number } | { type: 'next' }) =>
    setGame(reducePassAndPlay(game, a) as unknown as PassState);
  useQuietRound(view.phase === 'pass');
  useHoldToasts(true);
  const f = formatOf(view.mode);
  const cover = useRef<HTMLButtonElement>(null);

  // The hand-over cover takes focus, so the next player's Enter reveals and nothing else is focused.
  useEffect(() => {
    if (view.phase === 'pass' && !document.querySelector('dialog[open]')) cover.current?.focus();
  }, [view.phase, view.turn, view.roundIndex]);

  const head = (
    <header className="h-roundhead">
      <div className="h-roundhead__ids">
        <BrandName className="h-roundhead__brand" />
        <p className="h-roundhead__fmt">{isHi ? <span lang="hi">{formatNameHi(view.mode)}</span> : f.name}</p>
        <p className="h-roundhead__round">
          {view.phase === 'complete' ? t('Final', 'अंतिम') : roundOf(view.mode, view.roundIndex, isHi)} ·{' '}
          {t('Pass & Play', 'पास एंड प्ले')}
        </p>
      </div>
      <p className="h-roundhead__score">
        {/* A paragraph cannot carry an aria-label (naming is prohibited on its role): the words go in. */}
        <span className="h-sr">
          {t(
            `Score: ${view.names[0]} ${view.scores[0]}, ${view.names[1]} ${view.scores[1]}`,
            `स्कोर: ${view.names[0]} ${view.scores[0]}, ${view.names[1]} ${view.scores[1]}`,
          )}
        </span>
        <span className="h-roundhead__pill" aria-hidden="true">
          <span className="h-mono">{view.scores[0]}</span>
          <span className="h-roundhead__dash">–</span>
          <span className="h-mono">{view.scores[1]}</span>
        </span>
        <span className="h-roundhead__who" aria-hidden="true">
          {view.names[0]} · {view.names[1]}
        </span>
      </p>
      <MatchSettingsButton onClick={() => setAsking(true)} />
    </header>
  );

  let body = null;
  if (view.phase === 'pass') {
    const first = view.turn === 0;
    body = (
      <section className="h-handover" aria-labelledby="h-handover-title">
        <Kicker lang={isHi ? 'hi' : undefined}>
          {roundOf(view.mode, view.roundIndex, isHi).toUpperCase()}
        </Kicker>
        <h1 className="h-handover__title" id="h-handover-title">
          {t(`Hand the phone to ${view.holder}.`, `फ़ोन ${view.holder} को दीजिए।`)}
        </h1>
        <p className="h-handover__peek">{t("Don't peek.", 'झाँकना मना है।')}</p>
        {!first ? (
          <p className="h-handover__locked" role="status">
            {t(
              `${view.names[0]} has locked an answer. It stays hidden until you answer too.`,
              `${view.names[0]} ने जवाब लॉक कर दिया। आपके जवाब तक छिपा रहेगा।`,
            )}
          </p>
        ) : null}
        <Button ref={cover as never} variant="primary" onClick={() => act({ type: 'ready' })} trailing={null}>
          {t(`I'm ${view.holder} — show the question`, `मैं ${view.holder} हूँ — सवाल दिखाओ`)}
        </Button>
      </section>
    );
  } else if (view.phase === 'answer' && view.question) {
    const q = view.question;
    body = (
      <section className="h-pass__play" aria-labelledby="h-pass-stem">
        <p className="h-pass__turn">{t(`${view.holder}'s turn`, `${view.holder} की बारी`)}</p>
        <Kicker lang={isHi ? 'hi' : undefined}>{sectorName(q.topic, isHi).toUpperCase()}</Kicker>
        <h1 className="h-pass__stem" id="h-pass-stem" lang="en">
          {q.question}
        </h1>
        <Stopwatch clock={clock} practice />
        <OptionList
          options={q.options}
          onChoose={(i) => {
            if (clock.locked) return;
            const answerTimeMs = clock.lock();
            if (answerTimeMs === null) return;
            juice.sound('select');
            juice.haptic('light');
            act({ type: 'answer', choice: i, answerTimeMs });
          }}
          disabled={asking}
          keys={!asking}
          label={t('Answers', 'जवाब')}
        />
        <p className="h-pass__muted">
          {t('No deadline — take your time. First tap locks.', 'कोई समय सीमा नहीं — आराम से। पहला टैप लॉक।')}
        </p>
      </section>
    );
  } else if (view.phase === 'reveal' && view.question) {
    body = <PassReveal game={game} view={view} onNext={() => act({ type: 'next' })} />;
  } else if (view.phase === 'complete') {
    body = <PassResult game={game} view={view} onAgain={onAgain} onChange={onChange} />;
  }

  return (
    <div className="h-pass__game" data-phase={view.phase}>
      {head}
      {body}
      {asking ? (
        <MatchSettings
          pass
          running={view.phase === 'answer'}
          settled={view.phase === 'complete'}
          resultReady={view.phase === 'reveal' || view.phase === 'complete'}
          onClose={() => setAsking(false)}
          onQuit={() => navigate(href.duel({ vs: 'pass', mode: view.mode }))}
        />
      ) : null}
    </div>
  );
}

function PassReveal({ game, view, onNext }: { game: PassState; view: View; onNext: () => void }) {
  const { t, isHi } = useLang();
  const juice = useJuice();
  const round = game.rounds.at(-1)!;
  const q = view.question!;
  const item = itemById(round.question.id);
  const winner = view.result?.winner ?? null;
  const reason = view.result?.reason;
  const decided = !!game.decided;
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    juice.sound('stamp');
  }, [juice]);
  const line =
    winner !== null
      ? t(`${view.names[winner]} takes the round.`, `राउंड ${view.names[winner]} का।`)
      : reason === 'both-correct'
        ? t('Both right — a shared round, no point.', 'दोनों सही — साझा राउंड, कोई अंक नहीं।')
        : t('Neither answer was right. No point.', 'दोनों जवाब ग़लत। कोई अंक नहीं।');
  return (
    <div className="h-pass__reveal">
      <div className="h-pass__cols">
        <section className="h-pass__play" aria-labelledby="h-pass-rstem">
          <Kicker lang={isHi ? 'hi' : undefined}>
            {`${sectorName(q.topic, isHi)}${q.subtopic ? ` · ${q.subtopic}` : ''}`.toUpperCase()}
          </Kicker>
          <h1 className="h-pass__stem h-pass__stem--small" id="h-pass-rstem" lang="en">
            {q.question}
          </h1>
          <OptionList
            options={q.options}
            correctIndex={q.correctIndex ?? null}
            chosen={null}
            disabled
            keys={false}
            label={t('Answers and the key', 'जवाब और सही उत्तर')}
          />
          <ul className="h-pass__picks">
            {[0, 1].map((i) => {
              const a = view.answers[i] as { choice: number; correct: boolean; answerTimeMs?: number } | null;
              return (
                <li key={i} className="h-pass__pick">
                  <span className="h-pass__pickname">{view.names[i]}</span>
                  {a ? <PickMark choice={a.choice} /> : null}
                  <span className={a?.correct ? 'h-pass__v h-pass__v--pass' : 'h-pass__v h-pass__v--fail'}>
                    {a?.correct ? t('✓ right', '✓ सही') : t('✕ wrong', '✕ ग़लत')}
                    {typeof a?.answerTimeMs === 'number' ? ` · ${(Math.floor(a.answerTimeMs / 100) / 10).toFixed(1)} s` : ''}
                  </span>
                  <span className="h-stamp-stage">
                    <Stamp
                      kind={a?.correct ? 'pass' : 'fail'}
                      seed={`${round.question.id}-${i}`}
                      size="s"
                      text={a?.correct ? 'SAHI' : 'GALAT'}
                      animate
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="h-pass__line" role="status">
            {line}
          </p>
        </section>
        <section className="h-pass__evidence" aria-label={t('The receipt', 'रसीद')}>
          <Receipt item={item} printing label={t('Receipt', 'रसीद')} />
          {q.explanation ? (
            <NotingSheet collapsible summary={t('Read the noting', 'नोटिंग पढ़ें')}>
              <p lang="en">{q.explanation}</p>
            </NotingSheet>
          ) : null}
          <p className="h-pass__muted">
            {t(
              'Pass & Play is not recorded — two people share this phone.',
              'पास एंड प्ले दर्ज नहीं होता — दो लोग एक फ़ोन पर हैं।',
            )}
          </p>
        </section>
      </div>
      <div className="h-pass__bar">
        <div className="h-pass__barin">
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
          <Button variant="primary" onClick={onNext}>
            {decided ? t('See the verdict', 'फ़ैसला देखें') : t('Next round', 'अगला राउंड')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PassResult({
  game,
  view,
  onAgain,
  onChange,
}: {
  game: PassState;
  view: View;
  onAgain: () => void;
  onChange: () => void;
}) {
  const { t, isHi } = useLang();
  const juice = useJuice();
  const [scale, setScale] = useState(false);
  const w = view.winner;
  // The verdict cue plays once, on settle (bible §10): the 3D scale calls onSettled; the 2D scale
  // cues as it mounts; a 3D load that falls back to 2D is covered by the backstop.
  const scene3d = useMemo(() => sceneCapability().ok, []);
  const cued = useRef(false);
  const settleCue = useCallback(() => {
    if (cued.current) return;
    cued.current = true;
    juice.sound(w === null ? 'draw' : 'win');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);
  useEffect(() => {
    const id = setTimeout(() => {
      setScale(true);
      if (!scene3d) settleCue();
    }, 250);
    const backstop = scene3d ? setTimeout(settleCue, 4500) : undefined;
    return () => {
      clearTimeout(id);
      if (backstop) clearTimeout(backstop);
    };
  }, [scene3d, settleCue]);
  const [a, b] = view.scores;
  const word = w === null ? { en: 'BARABAR', hi: 'बराबर' } : { en: 'JEET', hi: 'जीत' };
  const sub =
    w === null
      ? t(`Level at ${a}–${b}`, `${a}–${b} पर बराबर`)
      : t(
          `${view.names[w]} wins ${Math.max(a, b)}–${Math.min(a, b)}`,
          `${view.names[w]} ${Math.max(a, b)}–${Math.min(a, b)} से जीते`,
        );
  return (
    <div className="h-pass__result">
      <div className="h-pass__cols">
        <section className="h-pass__verdict" aria-labelledby="h-pass-word">
          <Kicker lang={isHi ? 'hi' : undefined}>{t('PASS & PLAY RESULT', 'पास एंड प्ले नतीजा')}</Kicker>
          <h1 className="h-pass__word" id="h-pass-word">
            {isHi ? (
              <span lang="hi">{word.hi}</span>
            ) : (
              <>
                <span className="h-pass__wordhi" lang="hi">
                  {word.hi}
                </span>
                <span>{word.en}</span>
              </>
            )}
          </h1>
          <p className="h-pass__sub" role="status">
            {sub}
          </p>
          {w === null ? (
            // Two humans on one phone: Babu isn't playing, so the draw line doesn't name him.
            <p className="h-pass__muted">{t('Barabar. File dono ke naam.', 'बराबर। फ़ाइल दोनों के नाम।')}</p>
          ) : null}
          <div className="h-pass__scale">
            {scale ? (
              <Tarazu scores={[a, b]} names={view.names} winner={w} height={240} onSettled={settleCue} />
            ) : (
              <div className="h-pass__scalehold" aria-hidden="true" />
            )}
          </div>
        </section>
        <section className="h-pass__rounds" aria-label={t('Rounds', 'राउंड')}>
          <ol className="h-pass__list">
            {game.rounds.map((r) => {
              // Charter §2.2: a case answer never travels without its legal status, verbatim + as of.
              const it = itemById(r.question.id);
              const status = statusLine(it);
              return (
                <li key={r.index} className="h-pass__mini">
                  <Kicker as="span" lang={isHi ? 'hi' : undefined}>
                    {t(`ROUND ${r.index + 1}`, `राउंड ${r.index + 1}`)}
                  </Kicker>
                  <p className="h-pass__ministem" lang="en">
                    {r.question.question}
                  </p>
                  <p className="h-pass__answer">
                    ✓ <span lang="en">{r.question.options[r.question.correctIndex]}</span>
                  </p>
                  {it && status ? <LegalStatus status={status} asOf={it.asOf} /> : null}
                  <p className="h-pass__muted">
                    {r.answers.map((x, i) => `${view.names[i]} ${x?.correct ? '✓' : '✕'}`).join(' · ')}
                  </p>
                  <a
                    className="h-link h-link--tap"
                    href={r.question.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {r.question.sourceLabel}
                    <ExternalLink aria-hidden="true" size={14} strokeWidth={2.4} />
                    <span className="h-sr">{t('(opens in a new tab)', '(नए टैब में)')}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
      <p className="h-pass__more">
        <a className="h-link h-link--tap" href={href.duel({ vs: 'pass', mode: view.mode })}>
          {t('Back to Muqabla', 'मुक़ाबले पर वापस')}
        </a>
      </p>
      <div className="h-pass__bar">
        <div className="h-pass__barin">
          <Button variant="paper" size="s" onClick={onChange}>
            {t('Change players', 'खिलाड़ी बदलें')}
          </Button>
          <Button variant="primary" onClick={onAgain} icon={<RotateCcw size={20} strokeWidth={2.4} />}>
            {t('Play again', 'फिर खेलें')}
          </Button>
        </div>
      </div>
    </div>
  );
}
