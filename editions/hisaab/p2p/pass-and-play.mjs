/**
 * editions/hisaab/p2p/pass-and-play.mjs — two players, one phone, no clock.
 *
 * A pure reducer. Each round both seats answer the same question in turn, handing the phone over in
 * between; nothing is revealed until both have answered. The verdict is the engine's own
 * (`roundVerdict` in lib/server/room-engine.mjs) with speed taken out: the phone is passed by hand, so
 * both answers carry the same (zero) time and two correct answers are a shared round ('both-correct')
 * rather than a race. Formats are the engine's: Quick Draw 1 round, Triple Threat first to 2 of 3,
 * The Gauntlet 5 rounds; the match winner is decided by `matchDecided` / `matchWinner`, as in a room.
 *
 * Nothing here is written to a profile: two people share one device, so there is no one player to
 * award. A screen may still show the facts afterwards (`state.rounds[i].question`).
 *
 * Phases: 'pass' (hand the phone to `turn`; the question stays hidden) → 'answer' (that seat picks)
 * → back to 'pass' for the other seat → 'reveal' (both answers, the key and the round result) →
 * `next` → the next round's 'pass', or 'complete'.
 */
import { chooseDeck, MODE_ROUNDS, roundVerdict, matchDecided, matchWinner } from '../../../lib/server/room-engine.mjs';
import { QUESTIONS } from '../server/bank.mjs';

export const PASS_MODES = Object.freeze(Object.keys(MODE_ROUNDS));

/**
 * @param {{ mode?: 'quick'|'trilogy'|'gauntlet', names?: [string, string], filters?: object,
 *           questions?: object[], rng?: () => number }} [options]
 */
export function startPassAndPlay({ mode = 'trilogy', names = ['Player 1', 'Player 2'], filters = {}, questions = QUESTIONS, rng = Math.random } = {}) {
  if (!PASS_MODES.includes(mode)) throw new Error('Choose Quick Draw, Triple Threat or The Gauntlet.');
  const config = { domain: 'all', region: 'all', topic: 'all', subtopic: 'all', difficulty: 'all', ...filters, mode };
  const deck = chooseDeck(questions, config, rng);
  if (deck.length < MODE_ROUNDS[mode]) throw new Error(`Choose broader filters: this mode needs ${MODE_ROUNDS[mode]} questions.`);
  const clean = (n, i) => (typeof n === 'string' && n.trim() ? n.trim().slice(0, 24) : `Player ${i + 1}`);
  return {
    mode,
    names: [clean(names[0], 0), clean(names[1], 1)],
    deck,
    roundIndex: 0,
    turn: 0,
    answers: [null, null],
    scores: [0, 0],
    rounds: [],
    phase: 'pass',
    winner: null,
  };
}

/**
 * `{ type: 'ready' }` (the seat holding the phone is ready to see the question), `{ type: 'answer',
 * choice }` (0–3), `{ type: 'next' }` (after a reveal). Anything else, or out of turn, is identity.
 */
export function reducePassAndPlay(state, action) {
  if (!state || !action) return state;
  if (action.type === 'ready' && state.phase === 'pass') return { ...state, phase: 'answer' };
  if (action.type === 'answer' && state.phase === 'answer') {
    const choice = action.choice;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return state;
    const q = state.deck[state.roundIndex];
    const answers = state.answers.map((a, i) =>
      i === state.turn ? { choice, correct: choice === q.correctIndex, elapsedMs: 0, ...(Number.isFinite(action.answerTimeMs) && action.answerTimeMs >= 0 ? { answerTimeMs: action.answerTimeMs } : {}) } : a,
    );
    if (state.turn === 0) return { ...state, answers, turn: 1, phase: 'pass' };
    // Both in: the engine's verdict with equal (untimed) screen times.
    const { winner, reason } = roundVerdict(answers);
    const scores = state.scores.map((s, i) => (i === winner ? s + 1 : s));
    const result = { winner, reason: reason === 'close-result' ? 'both-correct' : reason };
    const rounds = [...state.rounds, { index: state.roundIndex, question: q, answers, result }];
    const decided = matchDecided(state.mode, state.roundIndex, scores);
    return {
      ...state,
      answers,
      scores,
      rounds,
      phase: 'reveal',
      decided,
      winner: decided ? matchWinner(scores) : null,
    };
  }
  if (action.type === 'next' && state.phase === 'reveal') {
    if (state.decided) return { ...state, phase: 'complete' };
    return { ...state, roundIndex: state.roundIndex + 1, turn: 0, answers: [null, null], phase: 'pass' };
  }
  return state;
}

/**
 * What the screen may show right now. The answer key and the other seat's pick are withheld until
 * the reveal, so a quick glance at the phone during the hand-over gives nothing away.
 */
export function passAndPlayView(state) {
  const q = state.deck[state.roundIndex];
  const hidden = state.phase === 'pass';
  const revealed = state.phase === 'reveal' || state.phase === 'complete';
  return {
    phase: state.phase,
    mode: state.mode,
    names: state.names,
    turn: state.turn,
    holder: state.names[state.turn],
    roundIndex: state.roundIndex,
    rounds: MODE_ROUNDS[state.mode],
    scores: state.scores,
    question: hidden
      ? null
      : {
          topic: q.topic,
          subtopic: q.subtopic,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options,
          ...(revealed
            ? {
                correctIndex: q.correctIndex,
                explanation: q.explanation,
                sourceUrl: q.sourceUrl,
                sourceLabel: q.sourceLabel,
              }
            : {}),
        },
    answers: revealed ? state.answers : state.answers.map((a) => (a ? { locked: true } : null)),
    result: revealed ? (state.rounds.at(-1)?.result ?? null) : null,
    winner: state.phase === 'complete' ? state.winner : null,
  };
}
