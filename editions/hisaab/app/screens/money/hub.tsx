/**
 * screens/money/hub.tsx — the money-trail hub (#/money): four manila files, one per mode, with real
 * counts, and ONE primary action — Resume the open money file, else "Pick a year" (Saal-dar-Saal
 * always has files, because every lane's items carry a year).
 */
import { useMemo, type ReactNode } from 'react';
import { CalendarRange, LifeBuoy, ScrollText, Vote, Wallet } from 'lucide-react';
import { MONEY_MODES, moneyRoutes, YEAR_MODE, yearRoutes, type MoneyTag, type Route } from '../../../edition';
import { href } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { Button } from '../../ui/button';
import { FileCover } from '../files/cover';
import { useLang } from '../../ui/lang';
import { Page, ScreenHeader } from '../../ui/page';
import { CARDS, fileStatus, usePlayerFiles, type Journeys } from '../files/lib';
import { FilesTabs } from '../files/tabs';
import { fileName, groupState, modeCode, groupStatus, tagged, TRAIL_SPAN, TRAIL_YEARS, yearCounts } from './lib';
import './money.css';

const ICONS: Readonly<Record<MoneyTag | 'years', ReactNode>> = {
  distribution: <Wallet size={24} strokeWidth={2.2} />,
  relief: <LifeBuoy size={24} strokeWidth={2.2} />,
  'pre-election': <Vote size={24} strokeWidth={2.2} />,
  years: <CalendarRange size={24} strokeWidth={2.2} />,
};

/** The newest open run among these files, for "Resume". */
function openRun(routes: readonly Route[], journeys: Journeys) {
  let best: { route: Route; done: number; at: number } | null = null;
  for (const r of routes) {
    const s = fileStatus(r, journeys);
    if (s.running && (!best || s.at > best.at)) best = { route: r, done: s.done, at: s.at };
  }
  return best;
}

export function MoneyHub() {
  const { t } = useLang();
  useScreenTitle('The money trail');
  const { journeys, loaded } = usePlayerFiles();
  const years = yearRoutes();
  const counts = useMemo(() => yearCounts(), []);
  const max = Math.max(1, ...counts.values());
  const all = useMemo(() => [...MONEY_MODES.flatMap((m) => moneyRoutes(m.tag)), ...years], [years]);
  const resume = loaded ? openRun(all, journeys) : null;
  const yearGroup = groupStatus(years, journeys);

  return (
    <Page screen="money" className="h-money">
      <FilesTabs current="money" />
      <ScreenHeader
        kicker={`F.No. P/${TRAIL_SPAN}`}
        titleHi="पैसे का हिसाब"
        title="The money trail"
        lead={t(
          'Public money handed out directly: who passed it, which party, and what happened next. 2000 to 2026, the Centre and the states.',
          'सीधे बाँटा गया जनता का पैसा: किसने दिया, किस पार्टी ने, और फिर क्या हुआ। 2000 से 2026, केंद्र और राज्य।',
        )}
      />
      <p className="h-quip h-money__quip">{t('Paisa seedha khaate mein. Hisaab seedha yahan.', 'पैसा सीधे खाते में। हिसाब सीधे यहाँ।')}</p>

      <div className="h-money__next">
        {resume ? (
          <Button variant="primary" href={href.route(resume.route.id)}>
            {t(
              `Resume ${fileName(resume.route)} · ${resume.done} of ${CARDS}`,
              `फ़ाइल जारी रखो · ${resume.done}/${CARDS}`,
            )}
          </Button>
        ) : (
          <Button variant="primary" href={href.money('years')}>
            {t('Pick a year', 'साल चुनो')}
          </Button>
        )}
        <p className="h-meta">{t('Every file: six cards, every answer sourced. Nothing padded.', 'हर फ़ाइल: छह कार्ड, हर जवाब का स्रोत। कुछ भरा नहीं गया।')}</p>
      </div>

      <ul className="h-money__modes" aria-label={t('Money-trail files', 'पैसे के हिसाब की फ़ाइलें')}>
        {MONEY_MODES.map((m) => {
          const routes = moneyRoutes(m.tag);
          const g = groupStatus(routes, journeys);
          const meta = routes.length ? t(`${m.gloss}. Sourced practice files.`, 'स्रोतों के साथ अभ्यास फ़ाइलें।') : t(`${m.gloss}. This file is being prepared.`, 'यह फ़ाइल तैयार हो रही है।');
          return (
            <li key={m.tag}>
              <FileCover
                fno={`F.No. ${modeCode(m.tag)}/ALL`}
                titleHi={m.titleDevanagari}
                title={m.title}
                icon={ICONS[m.tag]}
                meta={meta}
                state={routes.length ? groupState(g) : 'sealed'}
                seed={`money-${m.tag}`}
                href={href.money(m.tag)}
                progress={
                  routes.length && g.started
                    ? { value: g.cleared, max: g.total, label: t(`${g.cleared} of ${g.total} ${g.total === 1 ? 'file' : 'files'} cleared`, `${g.cleared}/${g.total} ${g.total === 1 ? 'फ़ाइल' : 'फ़ाइलें'} क्लियर`) }
                    : undefined
                }
              >
                {m.line}
              </FileCover>
            </li>
          );
        })}
        <li>
          <FileCover
            fno={`F.No. SAAL/${TRAIL_SPAN}`}
            titleHi={YEAR_MODE.titleDevanagari}
            title={YEAR_MODE.title}
            icon={ICONS.years}
            meta={t(
              `${YEAR_MODE.gloss}. ${years.length} ${years.length === 1 ? 'file' : 'files'} · ${TRAIL_SPAN}`,
              `${years.length} ${years.length === 1 ? 'फ़ाइल' : 'फ़ाइलें'} · ${TRAIL_SPAN}`,
            )}
            state={years.length ? groupState(yearGroup) : 'sealed'}
            seed="money-years"
            href={href.money('years')}
            progress={
              yearGroup.started
                ? { value: yearGroup.cleared, max: yearGroup.total, label: t(`${yearGroup.cleared} of ${yearGroup.total} ${yearGroup.total === 1 ? 'file' : 'files'} cleared`, `${yearGroup.cleared}/${yearGroup.total} ${yearGroup.total === 1 ? 'फ़ाइल' : 'फ़ाइलें'} क्लियर`) }
                : undefined
            }
          >
            <span className="h-money__spark" aria-hidden="true">
              {TRAIL_YEARS.map((y) => (
                <span key={y} className="h-money__sparkbar" style={{ height: `${Math.max((counts.get(y) ?? 0) ? 8 : 0, ((counts.get(y) ?? 0) / max) * 100)}%` }} />
              ))}
            </span>
            <span className="h-money__sparkaxis" aria-hidden="true">
              <span>{TRAIL_YEARS[0]}</span>
              <span>{TRAIL_YEARS[TRAIL_YEARS.length - 1]}</span>
            </span>
            {YEAR_MODE.line}
          </FileCover>
        </li>
        {/* The money ledger (screens/ledger): every measure on one timeline, with sources and downloads. */}
        <li>
          <FileCover
            fno="F.No. P/LEDGER"
            titleHi="पैसा कहाँ गया?"
            title="Paisa Kahan Gaya?"
            icon={<ScrollText size={24} strokeWidth={2.2} />}
            meta={t(
              `The money ledger. Every measure on one timeline, ${TRAIL_SPAN}: filter it, open each source, download it.`,
              `पैसे का लेखा: हर उपाय एक समयरेखा पर, ${TRAIL_SPAN}।`,
            )}
            state="open"
            seed="money-ledger"
            href={href.ledger()}
          >
            {t('Who passed it, which party governed, the poll it came before, and the result.', 'किसने दिया, किसकी सरकार थी, किस चुनाव से पहले, और नतीजा।')}
          </FileCover>
        </li>
      </ul>
    </Page>
  );
}
