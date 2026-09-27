/**
 * screens/home/file-entries.tsx — Home's entry points into the files (design bible §11.2 "four small
 * files", charter §6 game modes).
 *
 *  - The records room: four small manila covers (Rajya Rounds, Sector Files, Kiska Media?, Forward
 *    Court), each a whole-card link.
 *  - The money trail, 2000–2026: ONE manila folder holding four rows (Seedha Khaate Mein, Rahat Kosh,
 *    Chunav Se Pehle, Saal-dar-Saal). A list, not four more covers, so Home stays uncluttered. Its foot
 *    links the money-trail hub and, directly, Paisa Kahan Gaya? (the money ledger, #/money/ledger).
 *
 * Counts are the real route counts from edition.ts; a mode whose lanes are not registered yet says
 * "No files yet", never a padded number. Nothing here is violet-filled (Home's one primary lives above).
 */
import type { ReactNode } from 'react';
import { Banknote, CalendarRange, ChevronRight, Gavel, Grid3x3, Layers, LifeBuoy, Newspaper, Vote } from 'lucide-react';
import { formatNumber } from '../../data';
import { href } from '../../router';
import { useLang } from '../../ui/lang';
import { moneyEntries, recordsEntries, type Entry, type JourneysLike } from './home-data';

const ICONS: Readonly<Record<string, ReactNode>> = {
  rajya: <Grid3x3 size={20} strokeWidth={2.2} />,
  sector: <Layers size={20} strokeWidth={2.2} />,
  media: <Newspaper size={20} strokeWidth={2.2} />,
  forward: <Gavel size={20} strokeWidth={2.2} />,
  distribution: <Banknote size={22} strokeWidth={2.2} />,
  relief: <LifeBuoy size={22} strokeWidth={2.2} />,
  'pre-election': <Vote size={22} strokeWidth={2.2} />,
  years: <CalendarRange size={22} strokeWidth={2.2} />,
};

/** Discovery avoids inventory totals; only the player's own completed-file count is shown. */
function useCountLine(entry: Entry) {
  const { t } = useLang();
  const files = entry.files === 0 ? t('No files yet', 'अभी कोई फ़ाइल नहीं') : t('Explore the file', 'फ़ाइल देखें');
  const cleared =
    entry.cleared > 0 ? t(`${formatNumber(entry.cleared)} cleared`, `${formatNumber(entry.cleared)} पूरी`) : null;
  return { files, cleared };
}

function MiniFile({ entry }: { entry: Entry }) {
  const { t } = useLang();
  const { files, cleared } = useCountLine(entry);
  return (
    <li className="h-mini">
      <a className="h-mini__link" href={entry.to}>
        <span className="h-mini__tab">{entry.fno}</span>
        <span className="h-mini__head">
          <span className="h-mini__icon" aria-hidden="true">
            {ICONS[entry.id]}
          </span>
          <span className="h-mini__hi" lang="hi">
            {entry.titleHi}
          </span>
        </span>
        <span className="h-mini__title">{entry.title}</span>
        <span className="h-mini__gloss">{t(entry.gloss, entry.glossHi)}</span>
        <span className="h-mini__meta">
          <span className="h-mini__count">{files}</span>
          {cleared ? <span className="h-mini__count"> · {cleared}</span> : null}
        </span>
      </a>
    </li>
  );
}

function TrailRow({ entry }: { entry: Entry }) {
  const { t } = useLang();
  const { files, cleared } = useCountLine(entry);
  return (
    <li className="h-trail__item">
      <a className="h-trail__row" href={entry.to}>
        <span className="h-trail__icon" aria-hidden="true">
          {ICONS[entry.id]}
        </span>
        <span className="h-trail__names">
          <span className="h-trail__hi" lang="hi">
            {entry.titleHi}
          </span>
          <span className="h-trail__title">{entry.title}</span>
          <span className="h-trail__meta">
            <span>{t(entry.gloss, entry.glossHi)}</span>
            <span className="h-trail__count">
              {files}
              {cleared ? ` · ${cleared}` : ''}
              {entry.span && entry.files > 0 ? ` · ${entry.span}` : ''}
            </span>
          </span>
        </span>
        <ChevronRight aria-hidden="true" size={20} className="h-trail__chev" />
      </a>
    </li>
  );
}

export function FileEntries({ journeys }: { journeys: JourneysLike }) {
  const { t } = useLang();
  const records = recordsEntries(journeys);
  const money = moneyEntries(journeys);
  return (
    <div className="h-home__filegroups">
      <h2 className="h-sr" id="h-home-files">
        {t('Files', 'फ़ाइलें')}
      </h2>
      <div className="h-home__group">
        <div className="h-home__grouphead">
          <h3 className="h-home__h3">
            <span lang="hi" className="h-home__h3hi">
              रिकॉर्ड रूम
            </span>{' '}
            <span className="h-home__h3en">Records room</span>
          </h3>
          <a className="h-link h-link--tap h-home__grouplink" href={href.files()}>
            {t('All files', 'सारी फ़ाइलें')}
          </a>
        </div>
        <ul className="h-mini-grid" role="list">
          {records.map((e) => (
            <MiniFile key={e.id} entry={e} />
          ))}
        </ul>
      </div>

      <div className="h-trail" role="group" aria-labelledby="h-home-trail">
        <span className="h-trail__tab" aria-hidden="true">
          F.No. P/2000–26
        </span>
        <div className="h-trail__head">
          <h3 className="h-home__h3" id="h-home-trail">
            <span lang="hi" className="h-home__h3hi">
              पैसा कहाँ गया?
            </span>{' '}
            <span className="h-home__h3en">{t('The money trail', 'पैसे का हिसाब')}</span>
          </h3>
          <p className="h-trail__line">
            {t(
              '2000–2026. Who passed it, which party, what happened next.',
              '2000–2026. किसने पास किया, कौन-सी पार्टी, फिर क्या हुआ।',
            )}
          </p>
        </div>
        <ul className="h-trail__list" role="list">
          {money.map((e) => (
            <TrailRow key={e.id} entry={e} />
          ))}
        </ul>
        <div className="h-trail__links">
          <a className="h-link h-link--tap" href={href.money()}>
            {t('Open the money trail', 'पूरा हिसाब खोलो')}
          </a>
          {/* The money ledger (screens/ledger): every measure on one timeline, with sources and downloads. */}
          <a className="h-link h-link--tap" href={href.ledger()}>
            {t('Paisa Kahan Gaya? The full ledger', 'पैसा कहाँ गया? पूरा लेखा')}
          </a>
        </div>
      </div>
    </div>
  );
}
