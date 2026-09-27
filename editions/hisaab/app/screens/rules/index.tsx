/**
 * screens/rules/index.tsx — Rules & Sources / Corrections (design bible §11.17; charter §2, §6, §7).
 *
 * A long-read noting sheet: a TOC dropdown on phones, a sticky TOC beside a 62ch column from 900px.
 * Every number in "The game, in numbers" is read from the engine (lib/progression.mjs XP, the duel
 * formats, the tie window, the rank tiers, the stopwatch bands) — never retyped — so this page
 * cannot drift from what the game pays (N6). `?s=<section>` scrolls to a section (`?s=report&id=` also
 * pre-fills the report form). The ONE violet action is "Report an error in a question".
 */
import { useEffect, useMemo, useRef } from 'react';
import { Flag } from 'lucide-react';
import { ACHIEVEMENTS, progressionOptions, QUEST_TEMPLATES } from '@/lib/progression.mjs';
import { DUEL_FORMATS, EDITION } from '../../../edition';
import { XP_BANDS } from '../../../engine/scoring.mjs';
import {
  BABU_RANK_LADDER,
  BANK_ITEMS,
  BOT_LINE,
  BOT_NAME,
  formatNumber,
  LADDER_DISPLAY,
  SOURCE_KIND_TEXT,
  SOURCE_KINDS,
} from '../../data';
import { href, navigate, type ScreenProps } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { PublicationLinks } from '../../ads/ad-slot';
import { Button } from '../../ui/button';
import { Chip, SourceChip } from '../../ui/chip';
import { useLang } from '../../ui/lang';
import { Page, ScreenHeader } from '../../ui/page';
import { rungLevels, useMediaQuery, XP_TABLE } from '../me/lib';
import { STALE_MONTHS } from '../receipts/lib';
import { CHANGELOG, CORRECTIONS, laneCounts } from './corrections';
import { CORRECTIONS_EMAIL, ReportForm } from './report';
import '../../ui/noting-sheet.css';
import './rules.css';

type Section = { id: string; en: string; hi: string };
const SECTIONS: readonly Section[] = [
  { id: 'what', en: '1. What this is', hi: '1. यह क्या है' },
  { id: 'sources', en: '2. How we source', hi: '2. स्रोत कैसे चुनते हैं' },
  { id: 'status', en: '3. Legal status, dated', hi: '3. क़ानूनी स्थिति, तारीख़ के साथ' },
  { id: 'other-side', en: "4. The other side's answer", hi: '4. दूसरे पक्ष का जवाब' },
  { id: 'balance', en: '5. Balance', hi: '5. संतुलन' },
  { id: 'distractors', en: '6. Wrong options never smear', hi: '6. ग़लत विकल्प किसी को बदनाम नहीं करते' },
  { id: 'game', en: '7. The game, in numbers', hi: '7. खेल, अंकों में' },
  { id: 'privacy', en: '8. Privacy and connections', hi: '8. निजता और कनेक्शन' },
  { id: 'art', en: '9. What we never draw', hi: '9. हम क्या कभी नहीं बनाते' },
  { id: 'corrections', en: '10. Corrections and changes', hi: '10. सुधार और बदलाव' },
  { id: 'report', en: '11. Report an error', hi: '11. ग़लती बताओ' },
];

const STATUS_WORDS: ReadonlyArray<[string, string]> = [
  ['Alleged by …', 'Someone — an agency, a party, a newspaper, a short-seller — has claimed it. We always say who. Nothing has been proved.'],
  ['FIR registered', 'Police have recorded a complaint and may investigate. It is not a finding of anything.'],
  ['Arrested', 'Held by the police or an agency. Arrest is not guilt.'],
  ['Chargesheeted', 'Investigators have filed their charges in court. The trial is still to come.'],
  ['On bail', 'Released while the case goes on.'],
  ['Acquitted', 'A court found the charges not proved. An appeal may follow; we say so when one has.'],
  ['Convicted', 'A court found the person guilty. We name the court, and whether an appeal is pending.'],
  ['Case closed', 'The investigators closed the case (for example, a closure report). We say whether a court has accepted it.'],
  ['Court dismissed the petition', 'A court refused the petition. That is not always a ruling on the facts; we say what it decided.'],
];

/** A share in whole percent; a small non-zero count reads '<1', never '0' (2 items are not none). */
const pct = (n: number, total: number) => {
  if (!total || !n) return '0';
  const p = Math.round((n / total) * 100);
  return p === 0 ? '<1' : String(p);
};
const xpNum = (key: string) => Number(XP_TABLE[key]);
const xpBy = (key: string, mode: string) => Number((XP_TABLE[key] as Record<string, number>)[mode]);
/** The Stamp Register's rewards, read from the engine's achievement table (N6: never retyped). */
const REGISTER_XP: readonly number[] = [...new Set((ACHIEVEMENTS as ReadonlyArray<{ xp: number }>).map((a) => a.xp))].sort((a, b) => a - b);
/** What one daily quest pays, by size, from the engine's quest templates. */
const QUEST_XP: readonly number[] = [...new Set((QUEST_TEMPLATES as ReadonlyArray<{ xp: number }>).map((q) => q.xp))].sort((a, b) => a - b);
const listOr = (xs: ReadonlyArray<string | number>) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
const prettyDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
};

function Sec({ s, children }: { s: Section; children: React.ReactNode }) {
  const { t } = useLang();
  return (
    <section className="h-rules__sec h-sheet" id={`h-rules-${s.id}`} aria-labelledby={`h-rules-${s.id}-h`}>
      <h2 className="h-rules__h2" id={`h-rules-${s.id}-h`}>
        {t(s.en, s.hi)}
      </h2>
      <div className="h-rules__body">{children}</div>
    </section>
  );
}

export default function RulesScreen({ route }: ScreenProps) {
  const { t } = useLang();
  const wide = useMediaQuery('(min-width: 900px)');
  const section = route.query.s ?? '';
  const first = useRef(true);
  useScreenTitle(t('Rules & Sources', 'नियम और स्रोत'));

  useEffect(() => {
    if (!section) return;
    const el = document.getElementById(`h-rules-${section}`);
    if (!el) return;
    const smooth = !first.current && document.documentElement.dataset.motion !== 'reduced' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    first.current = false;
    // After the lazy screen has laid out.
    requestAnimationFrame(() => el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' }));
  }, [section]);

  const govt = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of BANK_ITEMS) map.set(q.govt, (map.get(q.govt) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, []);
  const lanes = useMemo(() => laneCounts(), []);
  const total = BANK_ITEMS.length;
  const withStatus = BANK_ITEMS.filter((q) => q.status).length;

  const jump = (id: string) => {
    navigate(href.rules(id), { replace: true });
    document.getElementById(`h-rules-${id}`)?.scrollIntoView({ block: 'start' });
  };

  const toc = (
    <nav className="h-rules__toc" aria-label={t('On this page', 'इस पन्ने पर')}>
      {wide ? (
        <ol className="h-rules__toclist">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={href.rules(s.id)}
                className="h-rules__toclink"
                aria-current={section === s.id ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  jump(s.id);
                }}
              >
                {t(s.en, s.hi)}
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <label className="h-rules__tocsel">
          <span className="h-rules__toclabel">{t('Jump to', 'यहाँ जाओ')}</span>
          <select className="h-rules__select" value={SECTIONS.some((s) => s.id === section) ? section : ''} onChange={(e) => e.target.value && jump(e.target.value)}>
            <option value="">{t('Choose a section…', 'हिस्सा चुनो…')}</option>
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.en, s.hi)}
              </option>
            ))}
          </select>
        </label>
      )}
    </nav>
  );

  const S = (id: string) => SECTIONS.find((s) => s.id === id)!;

  return (
    <Page screen="rules" className="h-rules">
      <ScreenHeader
        kicker={`F.No. R/${EDITION.questionCount} · ${t('The noting on the game', 'खेल की नोटिंग')}`}
        titleHi="नियम और स्रोत"
        title="Rules & Sources"
        lead={t('How every question is sourced and dated, what the game pays, and how to tell us we got something wrong.', 'हर सवाल का स्रोत और तारीख़, खेल क्या देता है, और ग़लती कैसे बताएँ।')}
      />
      <div className="h-rules__top">
        <Button variant="ghost" icon={<Flag size={18} strokeWidth={2.4} />} trailing={null} onClick={() => jump('report')}>
          {t('Found an error? Report it', 'ग़लती मिली? बताओ')}
        </Button>
      </div>

      <div className="h-rules__grid">
        <aside className="h-rules__side">{toc}</aside>
        <div className="h-rules__col">
          <Sec s={S('what')}>
            <p>
              HISAAB DO is a quiz about Indian public money — schemes, spending, scams, the institutions meant to catch them, elections, and who owns the news that told
              you. <strong>Every answer closes with a receipt:</strong> the source, the legal status with its date, the other side, and who governed then.
            </p>
            <p>
              Your rank is a label — the ones TV, WhatsApp and Reddit throw at people. You start as <strong>Andhbhakt</strong> (a blind devotee — of anyone, for
              anything) and, receipt by receipt, earn your way to <strong>Certified Anti-National</strong>: the label you get for asking where the money went. The
              satire is aimed at labelling and at blind devotion — never at a religion, caste, region or community, never at a party's voters, and never at a private
              citizen.
            </p>
            <p>
              <strong>Labels never apply to real people.</strong> A certificate whose name is, or contains, anyone named in our files prints “Anonymous Janta”.
              Certificates say “Satire. Not a government document.”
            </p>
            <p className="h-rules__hing">Funny at the top. Rigorous in the receipt. Nothing funny happens inside a receipt.</p>
          </Sec>

          <Sec s={S('sources')}>
            <p>Every question has a source that states the fact, chosen in this order of preference:</p>
            <ol className="h-rules__ol">
              <li>a court judgment or order;</li>
              <li>a CAG (Comptroller and Auditor General) report;</li>
              <li>a Parliament answer or record (sansad.in, PIB);</li>
              <li>official data: the Election Commission, the RBI, the Union Budget, PRS;</li>
              <li>an agency's own release (CBI, ED, SEBI);</li>
              <li>an established news outlet, or a fact-checker for Forward Court.</li>
            </ol>
            <p>Wikipedia is only ever a second source, never the only one for a claim about a named person. Every figure comes from the source; none are estimated.</p>
            <h3 className="h-rules__h3">{t('The source chip on a receipt', 'रसीद पर स्रोत का चिह्न')}</h3>
            <dl className="h-rules__legend">
              {SOURCE_KINDS.map((k) => (
                <div key={k} className="h-rules__legendrow">
                  <dt>
                    <SourceChip kind={k} />
                  </dt>
                  <dd>{SOURCE_KIND_TEXT[k]}</dd>
                </div>
              ))}
            </dl>
            <p className="h-rules__fine">
              The chip is read from the source's own web address. An agency's name appears only as the chip on a receipt sourced to that agency — we never stamp
              “CBI” or “ED” on anything.
            </p>
          </Sec>

          <Sec s={S('status')}>
            <p>
              Any question about alleged wrongdoing states the legal status exactly, in the same neutral grey block whatever it says — “alleged” is never red and
              “acquitted” is never green. The words mean:
            </p>
            <dl className="h-rules__defs">
              {STATUS_WORDS.map(([k, v]) => (
                <div key={k} className="h-rules__def">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="h-rules__stress">
              <Chip kind="legal">{t('Legal status', 'क़ानूनी स्थिति')}</Chip> {t('Nobody named here is guilty unless convicted.', 'दोषसिद्धि के बिना यहाँ कोई दोषी नहीं।')}
            </p>
            <h3 className="h-rules__h3">{t('How statuses are dated', 'स्थिति की तारीख़ कैसे')}</h3>
            <p>
              Every item carries an <strong>as-of month</strong>: the month someone last checked its status against a source. It prints beside the status — “as of
              Sep 2026” — on every receipt and every share card. {formatNumber(withStatus)} of the {formatNumber(total)} questions in this build carry a legal status.
            </p>
            <p>
              A status last checked more than {STALE_MONTHS} months ago is marked <strong>status older than {STALE_MONTHS} months</strong> in your Receipts Vault,
              with a link to the source. When we update an item, your Vault shows what it said when you collected it, struck through, and the change goes into the
              Corrections log below with its date.
            </p>
          </Sec>

          <Sec s={S('other-side')}>
            <p>
              Where a person, company or government denied or contested a claim, or a court or agency cleared them, the explanation says so in one clause. The other
              side's answer is part of the fact, not a footnote to it.
            </p>
          </Sec>

          <Sec s={S('balance')}>
            <p>
              The Centre has been led by the NDA since 2014, so central items from those years name NDA governments — that is proportion, not bias. State files
              cover whichever party governed that state. Handouts before elections are made by every party in power, and the money-trail files cover them all.
            </p>
            <p>Every item records who governed at that level then (“Govt then”). Reviewers audit the spread; in this build it is:</p>
            <ul className="h-rules__govt" aria-label={t('Items by government then', 'तब की सरकार के हिसाब से सवाल')}>
              {govt.map(([g, n]) => (
                <li key={g} className="h-rules__govtrow">
                  <Chip kind="govt">{g}</Chip>
                  <span className="h-mono">{formatNumber(n)}</span>
                  <span className="h-rules__pct">{pct(n, total)}%</span>
                </li>
              ))}
            </ul>
            <p className="h-rules__fine">
              No party colours, no team-picking, no party leaderboards. “Govt then” is the same neutral chip for everyone.
            </p>
          </Sec>

          <Sec s={S('distractors')}>
            <p>
              When the answer to a question is a person accused of something, the wrong options are never other real, identifiable people — they are roles,
              agencies, years, amounts or schemes. A wrong option must not smear anyone.
            </p>
            <p>
              One exception: “who launched, presented or passed it” questions in the money-trail files may offer other office-holders as options, because
              announcing a scheme is a public act, not an allegation. It never extends to a question about wrongdoing. And timing is a fact, motive is not: “announced
              47 days before polling” is on a receipt; “vote-buying” is only ever quoted, with who said it.
            </p>
          </Sec>

          <Sec s={S('game')}>
            <h3 className="h-rules__h3">{t('Labels and levels', 'लेबल और लेवल')}</h3>
            <p>
              XP to go from one level to the next is 80 × level<sup>1.55</sup>, rounded ({formatNumber(Math.round(80))} XP for level 1 → 2,{' '}
              {formatNumber(Math.round(80 * Math.pow(10, 1.55)))} for 10 → 11). Every five levels is a new label:
            </p>
            <table className="h-rules__table">
              <thead>
                <tr>
                  <th scope="col">{t('Label', 'लेबल')}</th>
                  <th scope="col">{t('Levels', 'लेवल')}</th>
                </tr>
              </thead>
              <tbody>
                {LADDER_DISPLAY.map((r) => (
                  <tr key={r.band}>
                    <td>
                      {r.en}
                      {r.aside ? ` ${r.aside}` : ''}
                    </td>
                    <td className="h-mono">{rungLevels(r.band).replace(/^Levels? /, '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="h-rules__h3">{t('Stopwatch answer XP', 'स्टॉपवॉच से जवाब का XP')}</h3>
            <p>The stopwatch starts when the question is shown and stops on your first answer. A correct answer earns:</p>
            <table className="h-rules__table">
              <thead><tr><th scope="col">Answer time</th><th scope="col">Answer XP</th></tr></thead>
              <tbody>
                {XP_BANDS.map((band) => <tr key={band.xp}><td>{band.label}</td><td className="h-mono">+{band.xp}</td></tr>)}
                <tr><td>Wrong or unanswered</td><td className="h-mono">0</td></tr>
              </tbody>
            </table>
            <p>
              Exactly 8 seconds earns {XP_BANDS[1].xp} XP; exactly 15 seconds earns {XP_BANDS[2].xp} XP. These are answer rewards.
              Separate receipt, file, match, Surprise Audit, streak, quest and Stamp Register bonuses appear in Activity.
              An old saved answer without a recorded time does not qualify for a speed bonus.
            </p>

            <h3 className="h-rules__h3">{t('Files (Rajya, Sector, Kiska Media?, Forward Court, the money trail)', 'फ़ाइलें')}</h3>
            <ul className="h-rules__ul">
              <li>Six cards with a stopwatch and no deadline; the first answer locks. Cards run simple → expert → extreme.</li>
              <li>The first time you answer a card in a file, it can earn stopwatch answer XP. Cards already answered in a file earn no more answer XP, even in another file.</li>
              <li>
                Your file score is the number of correct answers out of six, separate from stopwatch XP.
                A replay can improve your recorded best score without paying answer XP again.
              </li>
              <li>
                Clearing a file for the first time adds {xpNum('expeditionComplete')} completion XP and {xpNum('expeditionStamp')} stamp XP.
                Repeated file completions add no completion XP.
              </li>
            </ul>

            <h3 className="h-rules__h3">{t("Aaj Ka Hisaab and one-card links", 'आज का हिसाब')}</h3>
            <ul className="h-rules__ul">
              <li>Five questions a day, the same for everyone on the same local date, in the same order. The stopwatch has no deadline; a new file appears at local midnight.</li>
              <li>Aaj uses the stopwatch answer bands once for each card in that day’s file. One-card links use the same bands; reopening a saved answer does not pay it twice.</li>
            </ul>

            <h3 className="h-rules__h3">{t('Duels', 'मुक़ाबले')}</h3>
            <ul className="h-rules__ul">
              <li>
                Formats:{' '}
                {DUEL_FORMATS.map((f, i) => (
                  <span key={f.mode}>
                    <strong>{f.name}</strong> — {f.rounds === 1 ? '1 question' : f.mode === 'trilogy' ? `best of ${f.rounds}` : `${f.rounds} questions`}, {f.duration} s
                    each{i < DUEL_FORMATS.length - 1 ? '; ' : '.'}
                  </span>
                ))}
              </li>
              <li>
                The verdict: a right answer beats a wrong one. If both are right, the faster wins — unless the two are within {(EDITION.tieMs / 1000).toFixed(2)} s,
                which is a tie. Each device measures from when its question is shown; the stopwatch is not a precision comparison between devices. Options are never reshuffled mid-round.
              </li>
              <li>
                <strong>{BOT_NAME}</strong>: {BOT_LINE} It picks one of the four options at random and answers at a random moment between 1 s and half a second
                before the clock ends. It is always labelled BOT, and there is no hidden difficulty setting.
              </li>
              <li>
                A correct round earns the stopwatch answer XP above against either Babu-Bot or a friend; a wrong answer earns 0 answer XP.
                The duel closes each question after its deadline. File and daily questions have no deadline.
              </li>
              <li>
                <strong>Surprise Audit</strong> is a separate bonus on selected duel rounds: a ×2 audit adds one extra answer reward;
                a ×3 audit adds two. It never changes your base stopwatch band, and a wrong answer earns no audit bonus.
                The audit appears on the result receipt; from round 2 onward it is announced on the preceding receipt too.
              </li>
              <li>
                XP per match: a win pays {xpBy('matchWin', 'quick')} / {xpBy('matchWin', 'trilogy')} / {xpBy('matchWin', 'gauntlet')} (Quick Draw / Triple Threat /
                The Gauntlet), a loss {xpNum('matchLoss')}, a draw {xpNum('matchDraw')}; against a person × {xpNum('humanMultiplier')}. The Gauntlet won 5–0 adds{' '}
                {xpNum('perfectGauntlet')}.
              </li>
              <li>
                <strong>Babu rank</strong> (on this device only; there is no leaderboard): a win adds {xpBy('rankWin', 'quick')} / {xpBy('rankWin', 'trilogy')} /{' '}
                {xpBy('rankWin', 'gauntlet')} points by format
                {progressionOptions().rankHumanMatches ? ` (× ${xpNum('humanMultiplier')} against a person)` : ''}, a loss takes {Math.abs(xpNum('rankLoss'))}, a draw
                adds {xpNum('rankDraw')}.{' '}
                {progressionOptions().rankHumanMatches
                  ? ''
                  : 'Only duels against Babu-Bot move it: a duel with a friend pays XP but is unranked. '}
                You never drop below the rank you have reached.{' '}
                {BABU_RANK_LADDER.map((r, i) => (
                  <span key={r.id}>
                    {r.label} {formatNumber(r.min)}
                    {i < BABU_RANK_LADDER.length - 1 ? ' · ' : '.'}
                  </span>
                ))}
              </li>
              <li>A rematch or the next duel is always your tap. Nothing starts on its own.</li>
            </ul>

            <h3 className="h-rules__h3">{t('Pass & Play', 'पास एंड प्ले')}</h3>
            <p>Two players share one phone, handing it over between turns. There is no timer. A right answer beats a wrong one; both right is a shared round with no point. Pass & Play keeps its own match score and does not write XP to either player’s profile.</p>

            <h3 className="h-rules__h3">{t('Receipts and the Stamp Register', 'रसीदें और स्टैम्प रजिस्टर')}</h3>
            <ul className="h-rules__ul">
              <li>
                A new receipt — a question you collect for the first time outside Pass & Play — pays {xpNum('fact')} XP. The first time you answer it outside a duel (Aaj, a
                file, a one-card link or Dobara Jaanch) pays {xpNum('recall')} more.
              </li>
              <li>
                Opening a receipt in the Vault for the first time pays {xpNum('open')}. Keeping a copy of one pays {xpNum('save')}, once.
              </li>
              <li>Each stamp in the Stamp Register pays once: {listOr(REGISTER_XP)} XP, by how hard it is to earn.</li>
              <li>Coins in the tijori are a picture of your receipts: 1 coin = 1 sourced receipt. Not money. There is nothing to buy.</li>
            </ul>

            <h3 className="h-rules__h3">{t('Streaks, quests, re-checks', 'सिलसिला, काम, दोबारा जाँच')}</h3>
            <ul className="h-rules__ul">
              <li>
                {progressionOptions().visitCreditsStreak
                  ? 'A day counts when you open HISAAB DO.'
                  : 'A day counts when you answer a question, open a receipt in the Vault for the first time, or keep a copy of one. Just opening HISAAB DO does not count.'}{' '}
                Each day of a streak pays {xpNum('streakPerDay')} XP × the day, up to {xpNum('streakPerDay') * xpNum('streakCap')} a day.
              </li>
              <li>Every 7 days of streak earns one CL (casual leave), up to 2 in hand. A missed day uses one automatically. We never remind you about a streak.</li>
              <li>
                Three small daily quests pay {listOr(QUEST_XP)} XP each, and {xpNum('questBonus')} more when all three are done.
              </li>
              <li>
                Dobara Jaanch (in the Vault) plays cards your memory is due to see again: {xpNum('reviewCorrect')} XP right, {xpNum('review')} otherwise, only on
                a card that is due.
              </li>
            </ul>
          </Sec>

          <Sec s={S('privacy')}>
            <ul className="h-rules__ul">
              <li>
                <strong>No gameplay account required.</strong> Your progress, name and settings stay in this browser on this device.
                Export or delete your progress in Settings. Clearing browser storage removes local data.
              </li>
              <li>The browser requests the site and its assets from the hosting provider; the fonts are included in those assets. Solo gameplay does not upload your answers or progress to a gameplay server. Opening sources, WhatsApp or GitHub connects to those services when you choose.</li>
              <li>Advertising is off in the default release. If enabled later, labeled ads are limited to the home and receipt archive footers after an eligible consent choice. They do not appear in questions, live rounds, circles or result receipts, and never award XP. The Privacy page explains ad data and controls.</li>
              <li><strong>Circles</strong> save your per-circle nickname and people met on this device; choosing Connect shares that nickname and your self-reported device XP with online peers through the same peer-to-peer connections. Anyone holding the invite can join. There is no central member list or verified leaderboard; leaving removes your browser’s copy, not the invite.</li>
              <li>
                <strong>Duel a Friend</strong> is peer-to-peer. The two browsers find each other through public Nostr relays, which carry only the connection setup,
                protected by the room code; after that the browsers talk directly. Your name (or “Anonymous Janta”) and your answers and times go to the other
                player only. Some networks block direct connections, and there is no relay server to fall back on — that would mean running one.
              </li>
              <li>
                To connect directly, your browser asks public STUN servers (Google’s and Cloudflare’s) for its internet address, and the other player’s browser
                learns that address — as with any video call. The relays see your address and a scrambled room id. There is no central gameplay account service.
              </li>
              <li>
                Friend duels are casual and trust-based: each browser reports its own answer time, and a modified browser could lie. There are no stakes and no
                ranking between friends.
              </li>
              <li>Share cards are drawn on your phone and handed to your own share sheet; nothing is uploaded.</li>
              <li>We never send notifications: no push, no e-mail, no badges.</li>
            </ul>
            <PublicationLinks />
          </Sec>

          <Sec s={S('art')}>
            <ul className="h-rules__ul">
              <li>No State Emblem, Ashoka Chakra or “Satyamev Jayate” lock-up; no tricolour identity; no government letterhead or seals.</li>
              <li>No party symbols — not in the art, the icons or the emoji — and no party colours. Share grids use ✅ and ❌ only.</li>
              <li>No logos, mastheads or brand colours of media houses: outlet names are plain text.</li>
              <li>No outline map of India: states are a grid of tiles that makes no boundary claim.</li>
              <li>No photos, caricatures or silhouettes of real people.</li>
            </ul>
          </Sec>

          <Sec s={S('corrections')}>
            <h3 className="h-rules__h3">{t('Corrections log', 'सुधार सूची')}</h3>
            {CORRECTIONS.length ? (
              <table className="h-rules__table h-rules__table--log">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Item</th>
                    <th scope="col">Change</th>
                    <th scope="col">Why</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {CORRECTIONS.map((c) => (
                    <tr key={`${c.date}-${c.id}`}>
                      <td className="h-mono">{prettyDate(c.date)}</td>
                      <td className="h-mono">{c.id}</td>
                      <td>{c.change}</td>
                      <td>{c.why}</td>
                      <td>
                        <a className="h-link" href={c.source} target="_blank" rel="noopener noreferrer">
                          Source ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="h-rules__empty">
                No corrections yet. The first one will appear here with its date, the item id, what changed, why, and the source that shows it.
              </p>
            )}
            <p>
              {CORRECTIONS_EMAIL ? (
                <>
                  <strong>Named in a question?</strong> Write to{' '}
                  <a className="h-link" href={`mailto:${CORRECTIONS_EMAIL}`}>
                    {CORRECTIONS_EMAIL}
                  </a>
                  . We add your reply to the item and log the change.
                </>
              ) : (
                <>
                  <strong>Named in a question?</strong> Use the report form below with “I am named in this question — my reply”. We add your reply to the item and
                  log the change. The form's issue link is public on GitHub; there is no private address yet.
                </>
              )}
            </p>
            <h3 className="h-rules__h3">{t('Change log', 'बदलाव सूची')}</h3>
            <ol className="h-rules__log">
              {CHANGELOG.map((c) => (
                <li key={`${c.date}-${c.title}`} className="h-rules__logrow">
                  <span className="h-mono h-rules__logdate">{prettyDate(c.date)}</span>
                  <span>
                    <strong>{c.title}.</strong> {c.detail}
                  </span>
                </li>
              ))}
            </ol>
            <p className="h-rules__fine">
              {t('Files in this build', 'इस संस्करण की फ़ाइलें')} ({formatNumber(total)} {t('questions', 'सवाल')}):
            </p>
            <ul className="h-rules__lanes">
              {lanes.map((l) => (
                <li key={l.lane}>
                  {l.name} <span className="h-mono">{formatNumber(l.count)}</span>
                </li>
              ))}
            </ul>
          </Sec>

          <Sec s={S('report')}>
            <p className="h-rules__hing">Galti hui? Batao. Hum receipt ke saath sudhaarte hain.</p>
            <p>
              Tell us which question (its id is on every receipt, like <span className="h-mono">hsc001</span>), what is wrong, and a source that shows it. A
              correction goes into the log above with its date.
            </p>
            <ReportForm initialId={section === 'report' ? (route.query.id ?? '') : ''} />
          </Sec>
        </div>
      </div>
    </Page>
  );
}
