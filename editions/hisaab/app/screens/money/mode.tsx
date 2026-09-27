/**
 * screens/money/mode.tsx — one money-trail mode: Seedha Khaate Mein (distribution), Rahat Kosh
 * (relief) or Chunav Se Pehle (pre-election). Charter §4a, §4b, §6.
 *
 * The files are the foundation's derived routes (edition.ts moneyRoutes): the whole khaata, then each
 * 5-year era, then each state (the Centre first), each with ≥ 6 cards and never padded. The brief of
 * the next unfinished file holds the ONE primary action; every file card opens #/route/:id.
 * Chunav Se Pehle: every file carries the poll countdown chip ("47 days before UP Assembly 2022" — the
 * card closest to its poll) and the range of its six cards. Timing is a fact; motive is not (§4b.2):
 * no copy here characterises why anything was announced.
 * No files yet (lanes not registered) → the "being typed" file with the real count, and the way on.
 */
import { useMemo, type ReactNode } from 'react';
import { Timer } from 'lucide-react';
import { moneyMode, moneyRoutes, type MoneyTag, type Route } from '../../../edition';
import { formatNumber, SECTOR_NAMES_HI } from '../../data';
import { href } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { FileCover } from '../files/cover';
import { useLang } from '../../ui/lang';
import { Page, ScreenHeader } from '../../ui/page';
import { FileBrief } from '../files/brief';
import { bestText, CARDS, fileNo, fileStatus, nextUnfinished, usePlayerFiles, type Journeys } from '../files/lib';
import { FilesTabs, MoneyTabs } from '../files/tabs';
import { TypingFile } from '../files/typing';
import { groupStatus, modeCode, pollSummary, scopeTitle, scopeTitleHi, tagged, TRAIL_SPAN, type PollSummary } from './lib';
import './money.css';

/** One deadpan Hinglish line per mode (Latin script). Questions and facts, never motive. */
const QUIPS: Readonly<Record<MoneyTag, string>> = {
  distribution: 'Kisne diya, kisko mila, phir kya hua.',
  relief: 'Rahat aayi. Kitni, kab, kahan tak.',
  'pre-election': 'Tareekh bhi ek tathya hai.',
};

const QUIPS_HI: Readonly<Record<MoneyTag, string>> = {
  distribution: 'किसने दिया, किसको मिला, फिर क्या हुआ।',
  relief: 'राहत आई। कितनी, कब, कहाँ तक।',
  'pre-election': 'तारीख़ भी एक तथ्य है।',
};

/** Devanagari leads for the Hindi locale (the Latin lines are edition.ts MONEY_MODES). Draft — review. */
const LINES_HI: Readonly<Record<MoneyTag, string>> = {
  distribution: 'नक़द और सामान के रूप में सीधे बाँटा गया पैसा, 2000–2026: किसने दिया, किस पार्टी ने, फिर क्या हुआ।',
  relief: 'राहत कोष और आपदा का पैसा: कितना जुटा, कितना जारी हुआ, क्या विवाद हुआ, ऑडिट ने क्या कहा।',
  'pre-election': 'चुनाव से पहले के महीनों में क्या घोषित हुआ, बाँटा गया या पास हुआ — और नतीजा क्या रहा।',
};

/** The poll countdown chip (Chunav Se Pehle). Words carry it; the timer icon is a twin. */
export function PollChip({ poll, onManila }: { poll: PollSummary; onManila?: boolean }) {
  return (
    <span className={cx('h-money__poll', onManila && 'h-money__poll--manila')}>
      <Timer size={14} strokeWidth={2.6} aria-hidden="true" />
      <span>{poll.chip}</span>
    </span>
  );
}

/** "6 of 6 cards, 42 to 412 days before 4 polls." — the file's whole range, from the bank. */
export function pollRange(p: PollSummary, t: (en: string, hi?: string) => string = (en) => en): string {
  const polls = `${p.polls} ${p.polls === 1 ? 'poll' : 'polls'}`;
  if (p.min === null || p.max === null)
    return t(`${p.cards} of ${CARDS} cards lead up to ${polls}.`, `${CARDS} में से ${p.cards} कार्ड, ${p.polls} चुनावों से पहले।`);
  const span = p.min === p.max ? formatNumber(p.min) : `${formatNumber(p.min)} to ${formatNumber(p.max)}`;
  const spanHi = p.min === p.max ? formatNumber(p.min) : `${formatNumber(p.min)} से ${formatNumber(p.max)}`;
  return t(
    `${p.cards} of ${CARDS} cards, ${span} days before ${polls}.`,
    `${CARDS} में से ${p.cards} कार्ड, ${p.polls} चुनावों से ${spanHi} दिन पहले।`,
  );
}

export function ModeView({ tag }: { tag: MoneyTag }) {
  const { t, isHi } = useLang();
  const mode = moneyMode(tag);
  useScreenTitle(mode?.title ?? 'The money trail');
  const { journeys, loaded } = usePlayerFiles();
  const routes = moneyRoutes(tag);
  const pool = useMemo(() => tagged(tag).length, [tag]);
  const g = groupStatus(routes, journeys);
  const lead = nextUnfinished(routes, journeys);
  const leadStatus = fileStatus(lead, journeys);
  const chunav = tag === 'pre-election';
  const code = modeCode(tag);
  if (!mode) return null;

  const all = routes.filter((r) => r.scope === 'all' || !r.scope);
  const eras = routes.filter((r) => r.scope === 'era');
  const states = routes.filter((r) => r.scope === 'state');

  return (
    <Page screen={`money-${tag}`} className="h-money">
      <FilesTabs current="money" />
      <ScreenHeader
        kicker={`F.No. ${code}/${TRAIL_SPAN}`}
        titleHi={mode.titleDevanagari}
        title={mode.title}
        lead={t(mode.line, LINES_HI[tag])}
      />
      <p className="h-quip h-money__quip">
        {t(`${mode.gloss}. ${QUIPS[tag]}`, QUIPS_HI[tag])}
      </p>
      <MoneyTabs current={tag} />

      {routes.length && lead ? (
        <>
          <p className="h-money__tally">
            <span className="h-mono">{routes.length}</span> {routes.length === 1 ? t('file', 'फ़ाइल') : t('files', 'फ़ाइलें')} ·{' '}
            <span className="h-mono">
              {g.cleared}/{g.total}
            </span>{' '}
            {t('cleared', 'क्लियर')}
          </p>
          {chunav ? (
            <p className="h-money__legend">
              <Timer size={16} strokeWidth={2.6} aria-hidden="true" />
              <span>
                {t(
                  'The countdown on each file: days from the announcement or first payment to polling day, for the card closest to its poll.',
                  'हर फ़ाइल पर उलटी गिनती: घोषणा या पहले भुगतान से मतदान के दिन तक के दिन — मतदान के सबसे क़रीब वाले कार्ड के लिए।',
                )}
              </span>
            </p>
          ) : null}
          <div className="h-money__layout">
            <div className="h-money__side">
              <LeadBrief route={lead} tag={tag} journeys={journeys} loaded={loaded} titleHi={mode.titleDevanagari} running={leadStatus.running} isHi={isHi} />
            </div>
            <div className="h-money__main">
              <FileGroup title={t('The whole khaata', 'पूरा खाता')} titleHi="पूरा खाता" note={t(`Every year, ${TRAIL_SPAN}.`, `हर साल, ${TRAIL_SPAN}।`)} routes={all} journeys={journeys} chunav={chunav} />
              <FileGroup title={t('By era', 'दौर के हिसाब से')} titleHi="दौर के हिसाब से" note={t('Five-year slices. An era opens once it has six cards.', 'पाँच-पाँच साल। छह कार्ड होने पर दौर खुलता है।')} routes={eras} journeys={journeys} chunav={chunav} />
              <FileGroup title={t('By state', 'राज्य के हिसाब से')} titleHi="राज्य के हिसाब से" note={t('The Centre first. A state opens once it has six cards of its own.', 'पहले केंद्र। अपने छह कार्ड होने पर राज्य खुलता है।')} routes={states} journeys={journeys} chunav={chunav} />
            </div>
          </div>
        </>
      ) : (
        <div className="h-money__typing">
          <TypingFile
            fno={`F.No. ${code}/${TRAIL_SPAN}`}
            titleHi={mode.titleDevanagari}
            title={mode.title}
            pool={pool}
            action={
              <>
                <Button variant="primary" block href={href.money('years')}>
                  {t('Pick a year instead', 'इसके बजाय साल चुनो')}
                </Button>
                <p className="h-meta">{t('Saal-dar-Saal already has files from every lane.', 'साल-दर-साल में हर फ़ाइल के कार्ड पहले से हैं।')}</p>
              </>
            }
          />
        </div>
      )}
    </Page>
  );
}

function LeadBrief({
  route,
  tag,
  journeys,
  loaded,
  titleHi,
  running,
  isHi,
}: {
  route: Route;
  tag: MoneyTag;
  journeys: Journeys;
  loaded: boolean;
  titleHi: string;
  running: boolean;
  isHi: boolean;
}) {
  const { t } = useLang();
  const status = fileStatus(route, journeys);
  const poll = tag === 'pre-election' ? pollSummary(route) : null;
  const sectors = route.topics.map((s) => (isHi && SECTOR_NAMES_HI[s] ? SECTOR_NAMES_HI[s] : s));
  const facts: { k: string; v: ReactNode }[] = [
    { k: t('Cards', 'कार्ड'), v: `${CARDS} ${t('cards', 'कार्ड')}` },
    { k: t('Sectors', 'सेक्टर'), v: <span lang={isHi ? 'hi' : undefined}>{sectors.join(' · ')}</span> },
  ];
  if (status.best) facts.push({ k: t('Best', 'सर्वश्रेष्ठ'), v: <span className="h-mono">{bestText(status.best).replace(/^Best /, '')}</span> });
  return (
    <FileBrief
      route={route}
      status={status}
      loaded={loaded}
      kicker={running ? t('Open file', 'जारी फ़ाइल') : t('Next file', 'अगली फ़ाइल')}
      titleHi={scopeTitleHi(route) ?? titleHi}
      title={scopeTitle(route)}
      lead={
        poll ? (
          <>
            <PollChip poll={poll} />
            <p>{pollRange(poll, t)}</p>
          </>
        ) : (
          <p>{route.subtitle}</p>
        )
      }
      facts={facts}
    />
  );
}

function FileGroup({
  title,
  titleHi,
  note,
  routes,
  journeys,
  chunav,
}: {
  title: string;
  titleHi: string;
  note: string;
  routes: readonly Route[];
  journeys: Journeys;
  chunav: boolean;
}) {
  const { t, isHi } = useLang();
  if (!routes.length) return null;
  return (
    <section className="h-fsec" aria-label={title}>
      <div className="h-fsec__head">
        <h2 className="h-fsec__title">
          {isHi ? <span lang="hi">{titleHi}</span> : title}
        </h2>
        <p className="h-fsec__note">{note}</p>
      </div>
      <ul className="h-fsec__grid h-money__files">
        {routes.map((r) => {
          const s = fileStatus(r, journeys);
          const poll = chunav ? pollSummary(r) : null;
          const state = s.state === 'cleared' ? 'cleared' : s.state === 'progress' ? 'open' : 'sealed';
          return (
            <li key={r.id}>
              <FileCover
                fno={fileNo(r)}
                titleHi={scopeTitleHi(r)}
                title={r.scope === 'all' ? t('All years', 'सभी साल') : scopeTitle(r)}
                meta={`${CARDS} ${t('cards', 'कार्ड')}${s.best ? ` · ${bestText(s.best)}` : ''}`}
                state={state}
                seed={r.id}
                href={href.route(r.id)}
                progress={s.running ? { value: s.done, max: CARDS, label: `${s.done} of ${CARDS} answered` } : undefined}
              >
                {poll ? (
                  <>
                    <PollChip poll={poll} onManila />
                    <span className="h-money__pollrange">{pollRange(poll, t)}</span>
                  </>
                ) : null}
              </FileCover>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
