/** Browse practice files by year without publishing the question-bank inventory.
 * Session progress remains visible; year selection is keyboard-accessible.
 */
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { routeForYear, YEAR_MODE, yearRoutes, type Route } from '../../../edition';
import { SECTOR_NAMES_HI } from '../../data';
import { href, Link, navigate, type AppRoute } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { Page, ScreenHeader } from '../../ui/page';
import { FileBrief } from '../files/brief';
import { bestText, CARDS, fileStatus, lastOpened, revealIfHidden, statusWords, useMedia, usePlayerFiles, type FileStatus } from '../files/lib';
import { FilesTabs, MoneyTabs } from '../files/tabs';
import { TypingFile } from '../files/typing';
import { TRAIL_SPAN, TRAIL_YEARS, yearCounts, yearFileLabel } from './lib';
import './years.css';

const nearestFile = (year: number): Route | null => {
  for (let d = 1; d < TRAIL_YEARS.length; d++) {
    const r = routeForYear(year - d) ?? routeForYear(year + d);
    if (r) return r;
  }
  return null;
};

export function YearsView({ route }: { route: AppRoute }) {
  const { t, isHi } = useLang();
  useScreenTitle('Saal-dar-Saal');
  const { journeys, loaded } = usePlayerFiles();
  const wide = useMedia('(min-width: 900px)');
  const files = yearRoutes();
  const counts = useMemo(() => yearCounts(), []);
  const briefRef = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const fallback = useMemo(() => {
    const last = lastOpened(files, journeys);
    if (last?.years) return last.years[1];
    const latest = [...files].reverse()[0];
    return latest?.years?.[1] ?? TRAIL_YEARS[TRAIL_YEARS.length - 1];
  }, [files, journeys]);
  const asked = Number(route.query.y);
  const year = TRAIL_YEARS.includes(asked) ? asked : fallback;
  const file = routeForYear(year);
  const status = fileStatus(file, journeys);

  const select = useCallback(
    (y: number, focus = false) => {
      navigate(href.money('years', { y }), { replace: true });
      if (focus) requestAnimationFrame(() => strip.current?.querySelector<HTMLButtonElement>(`[data-year="${y}"]`)?.focus());
    },
    [],
  );

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TRAIL_YEARS.indexOf(year);
    const cols = Math.max(1, (strip.current ? getComputedStyle(strip.current).gridTemplateColumns.split(' ').length : 7));
    const to =
      e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' ? i - cols : e.key === 'ArrowDown' ? i + cols : e.key === 'Home' ? 0 : e.key === 'End' ? TRAIL_YEARS.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const y = TRAIL_YEARS[Math.max(0, Math.min(TRAIL_YEARS.length - 1, to))];
    select(y, true);
  };

  const readoutYear = hover ?? year;
  const readoutFile = routeForYear(readoutYear);

  return (
    <Page screen="money-years" className="h-years-page">
      <FilesTabs current="money" />
      <ScreenHeader kicker={`F.No. SAAL/${TRAIL_SPAN}`} titleHi={YEAR_MODE.titleDevanagari} title={YEAR_MODE.title} lead={t(YEAR_MODE.line, 'साल चुनो, 2000–2026: उस साल के कार्ड, हर फ़ाइल से।')} />
      <p className="h-quip h-years__quip">{t(`${YEAR_MODE.gloss}. Kaunsa saal? Har saal ka hisaab.`, 'कौनसा साल? हर साल का हिसाब।')}</p>
      <MoneyTabs current="years" />

      <figure className="h-years">
        <figcaption className="h-years__cap">
          <span className="h-years__captitle">{t('Choose a year to explore', 'जानने के लिए साल चुनें')}</span>
          <span className="h-years__readout" aria-hidden="true">
            <span className="h-mono">{readoutYear}</span>
            {readoutFile ? ` · ${readoutFile.merged ? t(`file ${yearFileLabel(readoutFile)}`, `फ़ाइल ${yearFileLabel(readoutFile)}`) : t('own file', 'अपनी फ़ाइल')}` : ` · ${t('no file', 'कोई फ़ाइल नहीं')}`}
          </span>
        </figcaption>
        <div
          ref={strip}
          className="h-years__strip"
          role="radiogroup"
          aria-label={t(`Explore years ${TRAIL_SPAN}`, `साल ${TRAIL_SPAN} देखें`)}
          onKeyDown={onKey}
          onPointerLeave={() => setHover(null)}
        >
          {TRAIL_YEARS.map((y) => {
            const n = counts.get(y) ?? 0;
            const f = routeForYear(y);
            const st = fileStatus(f, journeys);
            const same = !!file && !!f && f.id === file.id && y !== year;
            return (
              <button
                key={y}
                type="button"
                role="radio"
                aria-checked={y === year}
                tabIndex={y === year ? 0 : -1}
                data-year={y}
                className={cx('h-years__y', !n && 'h-years__y--empty', same && 'h-years__y--same', !f && 'h-years__y--nofile')}
                aria-label={yearLabel(y, n, f, st)}
                onClick={() => {
                  select(y);
                  if (!wide) requestAnimationFrame(() => revealIfHidden(briefRef.current));
                }}
                onPointerEnter={() => setHover(y)}
                onFocus={() => setHover(null)}
              >
                <span className="h-years__lbl" aria-hidden="true">
                  {y}
                </span>
                {st.state === 'cleared' ? <Check className="h-years__glyph" size={12} strokeWidth={3.4} aria-hidden="true" /> : null}
                {st.running ? <span className="h-years__dot" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <ul className="h-years__legend" aria-label={t('Legend', 'संकेत')}>
          <li>
            <span className="h-years__key h-years__key--bar" aria-hidden="true" />
            {t('Select a year to open its practice file', 'अभ्यास फ़ाइल खोलने के लिए साल चुनें')}
          </li>
          <li>
            <span className="h-years__key h-years__key--same" aria-hidden="true" />
            {t('Shaded: shares the selected year’s file', 'छाया: चुने साल की फ़ाइल में')}
          </li>
          <li>
            <Check size={14} strokeWidth={3.2} aria-hidden="true" className="h-years__keyicon" />
            {t('File cleared', 'फ़ाइल क्लियर')}
          </li>
          <li>
            <span className="h-years__key h-years__key--dot" aria-hidden="true" />
            {t('File open', 'फ़ाइल जारी')}
          </li>
        </ul>
      </figure>

      <div className="h-years__layout">
        <div className="h-years__brief" ref={briefRef}>
          {file ? (
            <FileBrief
              route={file}
              status={status}
              loaded={loaded}
              kicker={file.merged ? t(`${year} · shared file`, `${year} · साझा फ़ाइल`) : t('Year file', 'साल की फ़ाइल')}
              titleHi={`साल ${yearFileLabel(file)}`}
              title={yearFileLabel(file)}
              lead={
                <>
                  <p>{file.subtitle}</p>
                  {file.merged ? <p>{t('This edition groups nearby years in one practice file.', 'इस अभ्यास फ़ाइल में आसपास के साल शामिल हैं।')}</p> : null}
                </>
              }
              facts={[
                { k: t('Cards', 'कार्ड'), v: `${CARDS} ${t('cards', 'कार्ड')}` },
                { k: t('Sectors', 'सेक्टर'), v: <span lang={isHi ? 'hi' : undefined}>{file.topics.map((s) => (isHi && SECTOR_NAMES_HI[s] ? SECTOR_NAMES_HI[s] : s)).join(' · ')}</span> },
                ...(status.best ? [{ k: t('Best', 'सर्वश्रेष्ठ'), v: <span className="h-mono">{bestText(status.best).replace(/^Best /, '')}</span> }] : []),
              ]}
            />
          ) : (
            <NoFile year={year} count={counts.get(year) ?? 0} />
          )}
        </div>
        <YearTable files={files} counts={counts} journeys={journeys} wide={wide} current={file?.id ?? null} />
      </div>
    </Page>
  );
}

function yearLabel(y: number, n: number, f: Route | null, st: FileStatus) {
  const cards = f ? 'practice file available' : 'practice file being prepared';
  if (!f) return `${y}: ${cards}. No file yet.`;
  const which = f.merged ? `Shares the ${yearFileLabel(f)} file` : 'Own file';
  const state = st.state === 'cleared' ? 'cleared' : st.running ? `${st.done} of ${CARDS} answered` : 'sealed';
  return `${y}: ${cards}. ${which}, ${state}.`;
}

function NoFile({ year, count }: { year: number; count: number }) {
  const { t } = useLang();
  const near = nearestFile(year);
  return (
    <TypingFile
      fno={`F.No. SAAL/${year}`}
      titleHi={`साल ${year}`}
      title={`${year}`}
      pool={count}
      action={
        near ? (
          <Button variant="primary" block href={href.route(near.id)}>
            {t(`Open the nearest file · ${yearFileLabel(near)}`, `सबसे पास की फ़ाइल · ${yearFileLabel(near)}`)}
          </Button>
        ) : null
      }
    />
  );
}

/** The table twin of the strip: every year file with its count and state. */
function YearTable({
  files,
  counts,
  journeys,
  wide,
  current,
}: {
  files: readonly Route[];
  counts: ReadonlyMap<number, number>;
  journeys: ReturnType<typeof usePlayerFiles>['journeys'];
  wide: boolean;
  current: string | null;
}) {
  const { t } = useLang();
  const id = useId();
  const empty = TRAIL_YEARS.filter((y) => !routeForYear(y));
  const body = (
    <>
      <ul className="h-years__rows" aria-labelledby={id}>
        {files.map((f) => {
          const s = fileStatus(f, journeys);
          return (
            <li key={f.id}>
              <Link to={href.route(f.id)} className={cx('h-years__row', current === f.id && 'h-years__row--current')} aria-current={current === f.id ? 'true' : undefined}>
                <span className="h-years__rowyear h-mono">{yearFileLabel(f)}</span>
                <span className="h-years__rowmain">
                  <span className="h-years__rowcount">
                    {t('Practice file', 'अभ्यास फ़ाइल')}
                    {f.merged ? ` · ${t('merged years', 'साझा साल')}` : ''}
                  </span>
                  <span className="h-years__rowstate">{statusWords(s, t)}</span>
                </span>
                {s.state === 'cleared' ? <Check size={18} strokeWidth={3} aria-hidden="true" className="h-years__rowcheck" /> : null}
                <ChevronRight size={20} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
      {empty.length ? (
        <p className="h-years__none">
          {t('No cards yet from', 'अभी कोई कार्ड नहीं:')} <span className="h-mono">{empty.join(', ')}</span>.
        </p>
      ) : null}
    </>
  );
  if (wide)
    return (
      <section className="h-years__table">
        <h2 className="h-fsec__title" id={id}>
          {t('Every year file', 'हर साल की फ़ाइल')}
        </h2>
        {body}
      </section>
    );
  return (
    <details className="h-years__table h-years__table--fold">
      <summary className="h-years__summary">
        <span id={id}>{t(`List view · ${files.length} year files`, `सूची · ${files.length} फ़ाइलें`)}</span>
        <ChevronRight size={20} strokeWidth={2.4} aria-hidden="true" className="h-years__chev" />
      </summary>
      {body}
    </details>
  );
}
