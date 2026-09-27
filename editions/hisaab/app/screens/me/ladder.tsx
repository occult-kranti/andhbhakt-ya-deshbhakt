/**
 * screens/me/ladder.tsx — the label ladder, the hero of the Profile (design bible §11.14, §4.5).
 *
 * Nine rows, Certified Anti-National on top. Every rung is readable (knowing the joke is the pull):
 * Devanagari over Latin, the one-liner and its levels. Earned rungs carry an ISSUED stamp (with the date
 * where the record still has it); the current rung expands with the band meter, the Hinglish line and —
 * on phones — the certificate thumbnail and share action passed in as `current`.
 */
import type { ReactNode } from 'react';
import { FIRST_LABEL_NOTE, FIRST_LABEL_NOTE_HI, LADDER_DISPLAY, labelLine, type LabelDisplay } from '../../data';
import { Chip } from '../../ui/chip';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { Stamp } from '../../ui/stamp';
import { rungLevels, rungRange, shortDate } from './lib';

export type LadderProps = {
  band: number;
  /** Promotion dates by band (where known). */
  dates: ReadonlyMap<number, number>;
  /** The expanded body of the current rung (meter, certificate thumbnail, share). */
  current: ReactNode;
};

function RungTitle({ rung, big, isHi }: { rung: LabelDisplay; big: boolean; isHi: boolean }) {
  return (
    <h3 className={cx('h-rung__title', big && 'h-rung__title--big')}>
      <span className="h-rung__hi" lang="hi">
        {rung.hi}
      </span>
      <span className="h-rung__en" lang="en">
        {rung.en}
        {rung.aside ? (
          isHi && rung.asideHi ? (
            <small className="h-rung__aside" lang="hi">
              {' '}
              {rung.asideHi}
            </small>
          ) : (
            <small className="h-rung__aside"> {rung.aside}</small>
          )
        ) : null}
      </span>
    </h3>
  );
}

/** 'Levels 20–24' — in the Hindi locale 'लेवल 20–24', the word outside the mono span (no Devanagari in mono). */
function RungLevels({ band, isHi }: { band: number; isHi: boolean }) {
  if (!isHi) return <span className="h-mono">{rungLevels(band)}</span>;
  return (
    <span>
      <span lang="hi">लेवल</span> <span className="h-mono">{rungRange(band)}</span>
    </span>
  );
}

export function Ladder({ band, dates, current }: LadderProps) {
  const { t, isHi } = useLang();
  const rungs = [...LADDER_DISPLAY].reverse();
  return (
    <ol className="h-ladder" aria-label={t('The label ladder, top rung first', 'लेबल की सीढ़ी, सबसे ऊपर वाला पहले')}>
      {rungs.map((rung) => {
        const state = rung.band < band ? 'earned' : rung.band === band ? 'current' : 'future';
        const at = dates.get(rung.band);
        return (
          <li
            key={rung.band}
            id={state === 'current' ? 'h-rung-current' : undefined}
            className={cx('h-rung', `h-rung--${state}`)}
            aria-current={state === 'current' ? 'step' : undefined}
            aria-label={`${isHi ? rung.hi : rung.en}. ${labelLine(rung, isHi)} ${isHi ? `लेवल ${rungRange(rung.band)}` : rungLevels(rung.band)}. ${
              state === 'earned' ? t('Issued.', 'जारी।') : state === 'current' ? t('Your label now.', 'अभी आपका लेबल।') : t('Not yet.', 'अभी नहीं।')
            }`}
          >
            <div className="h-rung__head">
              <span className="h-rung__no" aria-hidden="true">
                {String(rung.ordinal).padStart(2, '0')}
              </span>
              <div className="h-rung__main">
                <RungTitle rung={rung} big={state === 'current'} isHi={isHi} />
                <p className="h-rung__line" lang={isHi ? 'hi' : undefined}>
                  {labelLine(rung, isHi)}
                </p>
                <p className="h-rung__meta">
                  <RungLevels band={rung.band} isHi={isHi} />
                  {state === 'current' ? <Chip kind="kind">{t('You are here', 'आप यहाँ हैं')}</Chip> : null}
                  {state === 'current' && at ? <span>{t('Issued', 'जारी')} {shortDate(at)}</span> : null}
                </p>
              </div>
              {state === 'earned' ? (
                <div className="h-rung__stamp" aria-hidden="true">
                  <Stamp
                    kind="noted"
                    size="s"
                    seed={`band-${rung.band}`}
                    text={at ? `ISSUED · ${shortDate(at).toUpperCase()}` : 'ISSUED'}
                  />
                </div>
              ) : null}
            </div>
            {state === 'current' ? (
              <div className="h-rung__body">
                <p className="h-rung__hinglish">“{rung.hinglish}”</p>
                {rung.band === 0 ? (
                  <p className="h-rung__note" lang={isHi ? 'hi' : undefined}>
                    {t(FIRST_LABEL_NOTE, FIRST_LABEL_NOTE_HI)}
                  </p>
                ) : null}
                {current}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
