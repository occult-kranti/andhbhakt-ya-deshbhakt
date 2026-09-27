/**
 * screens/start/index.tsx — First run (design bible §11.1). No account; a name is never asked for here
 * (it is optional, and only needed later for a certificate or a room).
 *
 * Phone: a full-height poster. The kicker F.No. 00/IN/<year> sits beside the EN/हिं toggle, then
 * हिसाब दो / SHOW US THE ACCOUNTS, the motto and three typed lines with real counts. Below it: the pitch
 * (or, after the first receipt, the inline label card), ONE violet primary (Open today's file) and three
 * text links (a state, the money trail, a duel code). Footer: "No account. Stored on this device. Rules &
 * sources". Desktop (≥ 900px): the poster on a halftone patch with static TIJORI art (7 cols) | the
 * action column (5 cols).
 *
 * After the first receipt the action column carries the inline label card ("You start as ANDHBHAKT…"),
 * never a ceremony. Silent: no sound until the first tap, no toasts, no WebGL (the tijori art is 2D).
 */
import { useEffect, useMemo } from 'react';
import { Coins, Grid3x3, KeyRound, Users } from 'lucide-react';
import { SECTOR_LIST, STATE_CODES } from '../../data';
import { todaysFive } from '../../../edition';
import { href, type ScreenProps } from '../../router';
import { useAppPlayer } from '../../shell/player';
import { TijoriArt, tijoriLabel } from '../../three';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { Page } from '../../ui/page';
import { Masthead } from '../../ui/masthead';
import { receiptStats } from '../home/home-data';
import { usePressCue } from '../home/press-cue';
import { isFreshProfile, markStartShown } from './first-run';
import { LabelCard } from './label-card';
import './start.css';

export default function StartScreen(_props: ScreenProps) {
  const player = useAppPlayer();
  const { t, isHi, locale, setLocale } = useLang();
  const onPointerDown = usePressCue();
  useEffect(() => markStartShown(), []);

  const profile = player.profile;
  const started = player.loaded && !isFreshProfile(profile);
  const receipts = useMemo(() => receiptStats(profile.journal).count, [profile.journal]);
  const daily = useMemo(() => todaysFive(), []);

  const xp = player.progression?.xp ?? 0;
  const year = new Date().getFullYear();

  const primary = { to: href.online(), label: t('Find a duel', 'मुक़ाबला ढूँढ़ो') };

  const lines = [
    t('Every answer comes with a receipt.', 'हर जवाब के साथ रसीद।'),
    t(
      `${STATE_CODES.length} states, ${SECTOR_LIST.length} sectors, one daily file.`,
      `${STATE_CODES.length} राज्य, ${SECTOR_LIST.length} सेक्टर, रोज़ एक फ़ाइल।`,
    ),
    t('Satire on labels. Facts from sources.', 'व्यंग्य लेबलों पर। तथ्य स्रोतों से।'),
  ];

  return (
    <Page screen="start" className="h-start">
      <Masthead day={daily.day} />
      <div className="h-start__root" onPointerDown={onPointerDown}>
        <section className="h-start__poster" aria-labelledby="h-start-title">
          <div className="h-start__head">
            <p className="h-kicker h-start__fno">{t('THE PUBLIC-MONEY QUIZ', 'जनता के पैसे का क्विज़')} · {year}</p>
            <div className="h-start__lang" role="group" aria-label={t('Language', 'भाषा')}>
              <button
                type="button"
                className="h-start__langbtn"
                aria-pressed={locale === 'en'}
                onClick={() => setLocale('en')}
                lang="en"
              >
                EN
              </button>
              <button
                type="button"
                className="h-start__langbtn"
                aria-pressed={locale === 'hi'}
                onClick={() => setLocale('hi')}
                lang="hi"
                aria-label="हिन्दी"
              >
                हिं
              </button>
            </div>
          </div>
          <div className="h-start__patch" id="h-start-title">
            <h1 className="h-start__editorial" lang={isHi ? 'hi' : 'en'}>
              {t('Big claims.', 'बड़े-बड़े दावे।')}<br />
              <em>{t('Show us the receipts.', 'रसीद तो दिखाओ।')}</em>
            </h1>
          </div>
          {isHi ? (
            <p className="h-start__motto h-start__motto--hi" lang="hi">
              जनता का पैसा। जनता का सवाल।
            </p>
          ) : (
            <p className="h-start__motto">
              <span className="h-start__mottoline">Janta ka paisa. Janta ka sawaal.</span>
              <span className="h-start__gloss">The people’s money. The people’s question.</span>
            </p>
          )}
          <ol className={cx('h-start__typed', isHi && 'h-start__typed--hi')}>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <div className="h-start__artifact">
            <div className="h-start__art" role="img" aria-label={tijoriLabel(receipts, locale)}><TijoriArt count={receipts} /></div>
            <p className="h-start__caption">{t('Collect facts. Keep the receipts. Form your own opinion.', 'तथ्य जुटाओ। रसीद सँभालो। अपनी राय ख़ुद बनाओ।')}</p>
          </div>
        </section>

        <section className="h-start__action" aria-labelledby="h-start-action">
          {started ? (
            <LabelCard xp={xp} intro headingId="h-start-action" />
          ) : (
            <div className="h-start__pitch">
              <p className="h-kicker">{t('HUMAN VS HUMAN', 'इंसान बनाम इंसान')}</p>
              <h2 className="h-start__h2" id="h-start-action" lang={isHi ? 'hi' : undefined}>
                {t('Same question. Real opponent.', 'एक सवाल। असली प्रतिद्वंद्वी।')}
              </h2>
              <p className="h-start__sub">
                {t(
                  "Enter a duel with an optional coin stake, or learn at your own pace in today’s file.",
                  'वैकल्पिक सिक्कों के साथ मुक़ाबला करो, या आज की फ़ाइल में अपनी गति से सीखो।',
                )}
              </p>
            </div>
          )}
          <Button variant="primary" block href={primary.to} className="h-start__go">
            {primary.label}
          </Button>
          <Button variant="paper" block href={href.aaj()}>{t("Practice today’s file", "आज की फ़ाइल का अभ्यास")}</Button>
          <div className="h-start__xp" aria-label={t('XP for correct answers', 'सही जवाब के XP')}>
            <span><strong>30 XP</strong>{t('under 8s', '8 से॰ से कम')}</span>
            <span><strong>20 XP</strong>{t('under 15s', '15 से॰ से कम')}</span>
            <span><strong>10 XP</strong>{t('15s or more', '15 से॰ या ज़्यादा')}</span>
          </div>
          <ul className="h-start__links">
            <li>
              <a className="h-start__link" href="#/circles">
                <Users aria-hidden="true" size={20} strokeWidth={1.8} />
                <span>{t('Create a friends or family circle', 'दोस्तों या परिवार का सर्कल बनाओ')}</span>
              </a>
            </li>
            <li>
              <a className="h-start__link" href={href.files('states')}>
                <Grid3x3 aria-hidden="true" size={20} strokeWidth={2.2} />
                <span>{t('Pick a state instead', 'कोई राज्य चुनो')}</span>
              </a>
            </li>
            <li>
              <a className="h-start__link" href={href.money()}>
                <Coins aria-hidden="true" size={20} strokeWidth={2.2} />
                <span>{t('Follow the money, 2000–2026', 'पैसे का हिसाब, 2000–2026')}</span>
              </a>
            </li>
            <li>
              <a className="h-start__link" href={href.friend()}>
                <KeyRound aria-hidden="true" size={20} strokeWidth={2.2} />
                <span>{t('Have a duel code?', 'मुक़ाबले का कोड है?')}</span>
              </a>
            </li>
          </ul>
        </section>

        <footer className="h-start__foot">
          <p>
            {t('No account. Stored on this device.', 'कोई अकाउंट नहीं। सब इसी डिवाइस पर।')}{' '}
            <a className="h-link h-link--tap" href={href.rules()}>
              {t('Rules & sources', 'नियम और स्रोत')}
            </a>
          </p>
        </footer>
      </div>
    </Page>
  );
}
