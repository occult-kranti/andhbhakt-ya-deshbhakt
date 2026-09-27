/**
 * screens/files/rajya.tsx — Rajya Rounds: the records-room cartogram (bible §11.3).
 *
 * A 7 × 7 almirah of 30 state drawers + the Centre drawer — not a map; it makes no boundary claim.
 * Tiles carry glyph twins (tape = sealed, bar + fraction = in progress, ✓ = cleared). Tapping a tile
 * selects it and the file brief below (phone) or beside it (≥ 900px) holds the ONE primary action,
 * Open / Resume file. An equivalent list view (alphabetical, searchable, same data) is one tap away.
 * Selection and view live in the URL query (?s=UP&v=list), replaced — not pushed — on change.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { Check, ChevronRight, LayoutGrid, List, Search } from 'lucide-react';
import { useJuice } from '@/components/fx';
import { routesOfKind, type Route } from '../../../edition';
import { CARTOGRAM, CARTOGRAM_CENTRE, SECTOR_NAMES_HI, STATE_CODES, stateName, stateNameHi } from '../../data';
import { href, Link, navigate, type AppRoute } from '../../router';
import { useScreenTitle } from '../../shell/chrome';
import { Button } from '../../ui/button';
import { cx } from '../../ui/cx';
import { useLang } from '../../ui/lang';
import { Meter } from '../../ui/meter';
import { Page, ScreenHeader } from '../../ui/page';
import { Skeleton } from '../../ui/skeleton';
import { Stamp } from '../../ui/stamp';
import { Tape } from '../../ui/tape';
import { Tile, type TileState } from '../../ui/tile';
import {
  bestText,
  CARDS,
  fileNo,
  fileStatus,
  lastOpened,
  openWords,
  revealIfHidden,
  stateCardsLine,
  statusWords,
  useMedia,
  usePlayerFiles,
  type FileStatus,
  type Journeys,
} from './lib';
import { FilesTabs } from './tabs';
import './rajya.css';

const CENTRE = 'IN';

type Drawer = {
  code: string;
  name: string;
  nameHi: string;
  route: Route | null;
  status: FileStatus;
};

function tileState(s: FileStatus): TileState {
  return s.state === 'cleared' ? 'cleared' : s.state === 'progress' ? 'progress' : 'sealed';
}

/** The Centre drawer: its cards are the Sector Files (Kiska Media? and Forward Court too). */
function centreSummary(journeys: Journeys) {
  const sectors = routesOfKind('sector');
  const cleared = sectors.filter((r) => fileStatus(r, journeys).state === 'cleared').length;
  const started = sectors.filter((r) => fileStatus(r, journeys).state !== 'sealed').length;
  return { total: sectors.length, cleared, started };
}

export function RajyaView({ route }: { route: AppRoute }) {
  const { t, isHi } = useLang();
  useScreenTitle('Rajya Rounds');
  const juice = useJuice();
  const { journeys, loaded } = usePlayerFiles();
  const wide = useMedia('(min-width: 900px)');
  const briefRef = useRef<HTMLElement>(null);
  const [announce, setAnnounce] = useState('');

  const byState = useMemo(() => new Map(routesOfKind('state').map((r) => [r.state ?? '', r])), []);
  const drawers = useMemo(() => {
    const map = new Map<string, Drawer>();
    for (const code of STATE_CODES) {
      const r = byState.get(code) ?? null;
      map.set(code, { code, name: stateName(code), nameHi: stateNameHi(code), route: r, status: fileStatus(r, journeys) });
    }
    return map;
  }, [byState, journeys]);
  const centre = useMemo(() => centreSummary(journeys), [journeys]);

  const list = route.query.v === 'list';
  const query = route.query.q ?? '';
  const asked = route.query.s?.toUpperCase();
  const fallback = useMemo(() => {
    const last = lastOpened(routesOfKind('state'), journeys);
    return last?.state ?? routesOfKind('state')[0]?.state ?? CENTRE;
  }, [journeys]);
  const selected = asked && (asked === CENTRE || drawers.has(asked)) ? asked : fallback;

  const base = route.view === 'hub' ? undefined : ('states' as const);
  const setQuery = useCallback(
    (next: Record<string, string | undefined>) => {
      const q: Record<string, string> = {};
      const merged = { s: route.query.s, v: route.query.v, q: route.query.q, ...next };
      for (const [k, v] of Object.entries(merged)) if (v) q[k] = v;
      navigate(href.files(base, q), { replace: true });
    },
    [base, route.query.q, route.query.s, route.query.v],
  );

  const select = (code: string) => {
    juice.sound('tap');
    juice.haptic('light');
    setQuery({ s: code });
    const d = drawers.get(code);
    setAnnounce(
      code === CENTRE
        ? t('Centre drawer selected.', 'केंद्र की दराज़ चुनी।')
        : `${d?.name ?? code}: ${d ? statusWords(d.status, t) : ''}`,
    );
    if (!wide) requestAnimationFrame(() => revealIfHidden(briefRef.current));
  };

  const cleared = [...drawers.values()].filter((d) => d.status.state === 'cleared').length;
  const open = [...drawers.values()].filter((d) => d.status.state === 'progress').length;

  return (
    <Page screen="files-states" className="h-rajya">
      <FilesTabs current="states" />
      <ScreenHeader
        kicker={`F.No. R/IN · ${STATE_CODES.length} + 1 ${t('drawers', 'दराज़ें')}`}
        titleHi="राज्य राउंड्स"
        title="Rajya Rounds"
        lead={t('Pick a state. 6 cards. Every answer has a receipt.', 'राज्य चुनो। 6 कार्ड। हर जवाब की रसीद।')}
        aside={
          <div className="h-segs h-rajya__viewswitch" role="group" aria-label={t('How to show the files', 'फ़ाइलें कैसे दिखें')}>
            <button type="button" className="h-seg" aria-pressed={!list} onClick={() => setQuery({ v: undefined })}>
              <LayoutGrid size={18} strokeWidth={2.4} aria-hidden="true" />
              {t('Almirah', 'अलमारी')}
            </button>
            <button type="button" className="h-seg" aria-pressed={list} onClick={() => setQuery({ v: 'list' })}>
              <List size={18} strokeWidth={2.4} aria-hidden="true" />
              {t('List view', 'सूची')}
            </button>
          </div>
        }
      />
      <p className="h-rajya__tally">
        <span className="h-mono">
          {cleared}/{STATE_CODES.length}
        </span>{' '}
        {t('cleared', 'क्लियर')}
        {open ? (
          <>
            {' · '}
            <span className="h-mono">{open}</span> {t('open', 'जारी')}
          </>
        ) : null}
        <span className="h-rajya__quip">{t('Kaunsa rajya? Sab ki file khuli hai.', 'कौनसा राज्य? सबकी फ़ाइल खुली है।')}</span>
      </p>

      <p className="h-sr" role="status" aria-live="polite">
        {announce}
      </p>

      {list ? (
        <div className="h-rajya__layout h-rajya__layout--list">
          <div className="h-rajya__main">
            {!wide ? <QuickOpen drawer={selected === CENTRE ? null : drawers.get(selected) ?? null} loaded={loaded} /> : null}
            <StateList drawers={drawers} centre={centre} query={query} onQuery={(q) => setQuery({ q: q || undefined })} />
          </div>
          {wide ? <Brief ref={briefRef} drawer={selected === CENTRE ? null : drawers.get(selected) ?? null} centre={centre} loaded={loaded} isHi={isHi} /> : null}
        </div>
      ) : (
        <div className="h-rajya__layout">
          <div className="h-rajya__main">
            <TileSearch drawers={drawers} query={query} onQuery={(q) => setQuery({ q: q || undefined })} onPick={select} />
            <Cartogram drawers={drawers} centre={centre} selected={selected} query={query} loaded={loaded} onSelect={select} />
            <Legend />
          </div>
          <Brief ref={briefRef} drawer={selected === CENTRE ? null : drawers.get(selected) ?? null} centre={centre} loaded={loaded} isHi={isHi} />
        </div>
      )}
    </Page>
  );
}

// ---- the almirah ----------------------------------------------------------------------------------------

const matches = (d: { code: string; name: string; nameHi: string }, q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return d.code.toLowerCase() === s || d.name.toLowerCase().includes(s) || d.nameHi.includes(q.trim());
};

type Pos = { r: number; c: number };
const POS = new Map<string, Pos>();
CARTOGRAM.forEach((row, r) => row.forEach((code, c) => code && POS.set(code, { r, c })));
POS.set(CENTRE, { r: CARTOGRAM_CENTRE.row, c: CARTOGRAM_CENTRE.col });
const at = (r: number, c: number): string | null => {
  if (r === CARTOGRAM_CENTRE.row && c >= CARTOGRAM_CENTRE.col && c < CARTOGRAM_CENTRE.col + CARTOGRAM_CENTRE.span) return CENTRE;
  return CARTOGRAM[r]?.[c] ?? null;
};

/** Arrow keys walk the almirah (skipping empty cells); every tile also stays in the Tab order. */
function onArrow(e: KeyboardEvent<HTMLDivElement>) {
  const step = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
  if (!step) return;
  const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-code]');
  const from = cell ? POS.get(cell.dataset.code ?? '') : null;
  if (!from) return;
  let { r, c } = from;
  for (let i = 0; i < 7; i++) {
    r += step[0];
    c += step[1];
    if (r < 0 || r > 6 || c < 0 || c > 6) return;
    const code = at(r, c);
    if (code && code !== cell?.dataset.code) {
      e.preventDefault();
      e.currentTarget.querySelector<HTMLButtonElement>(`[data-code="${code}"] button`)?.focus();
      return;
    }
  }
}

function Cartogram({
  drawers,
  centre,
  selected,
  query,
  loaded,
  onSelect,
}: {
  drawers: Map<string, Drawer>;
  centre: ReturnType<typeof centreSummary>;
  selected: string;
  query: string;
  loaded: boolean;
  onSelect: (code: string) => void;
}) {
  const { t } = useLang();
  const centreState: TileState = centre.total > 0 && centre.cleared === centre.total ? 'cleared' : centre.started ? 'progress' : 'sealed';
  // Starts with the drawer's visible words ('IN', 'Centre') — WCAG 2.5.3 label in name.
  const centreLabel =
    centreState === 'sealed'
      ? t(`IN Centre drawer: ${centre.total} sector files, none opened`, `IN केंद्र: ${centre.total} सेक्टर फ़ाइलें`)
      : t(`IN Centre drawer: ${centre.cleared} of ${centre.total} sector files cleared`, `IN केंद्र: ${centre.cleared}/${centre.total} सेक्टर फ़ाइलें क्लियर`);
  return (
    <div
      className={cx('h-rajya__grid', !loaded && 'h-rajya__grid--loading')}
      role="group"
      aria-label={t('Records room: 30 state drawers and the Centre', 'रिकॉर्ड रूम: 30 राज्य और केंद्र')}
      aria-busy={!loaded || undefined}
      onKeyDown={onArrow}
    >
      {CARTOGRAM.flatMap((row, r) =>
        row.map((code, c) => {
          if (!code) return null;
          const d = drawers.get(code);
          if (!d) return null;
          const st = tileState(d.status);
          return (
            <div
              key={code}
              className={cx('h-rajya__cell', !matches(d, query) && 'h-rajya__cell--dim')}
              style={{ gridRow: r + 1, gridColumn: c + 1 }}
              data-code={code}
            >
              {d.route ? (
                <Tile
                  code={code}
                  name={d.name}
                  nameHi={d.nameHi}
                  state={st}
                  progress={st === 'progress' ? { done: d.status.done, total: CARDS } : undefined}
                  selected={selected === code}
                  onSelect={onSelect}
                  tabIndex={selected === code ? 0 : -1}
                  showName
                />
              ) : (
                <button
                  type="button"
                  className="h-tile h-rajya__nofile"
                  aria-pressed={selected === code}
                  aria-label={t(`${code}, ${d.name}: no file yet`, `${code}, ${d.nameHi || d.name}: अभी फ़ाइल नहीं`)}
                  tabIndex={selected === code ? 0 : -1}
                  onClick={() => onSelect(code)}
                >
                  <span className="h-tile__code" aria-hidden="true">
                    {code}
                  </span>
                </button>
              )}
            </div>
          );
        }),
      )}
      <div
        className="h-rajya__cell h-rajya__cell--centre"
        style={{ gridRow: CARTOGRAM_CENTRE.row + 1, gridColumn: `${CARTOGRAM_CENTRE.col + 1} / span ${CARTOGRAM_CENTRE.span}` }}
        data-code={CENTRE}
      >
        <button
          type="button"
          className={cx('h-tile', 'h-tile--wide', `h-tile--${centreState}`, 'h-rajya__centre')}
          aria-pressed={selected === CENTRE}
          aria-label={centreLabel}
          tabIndex={selected === CENTRE ? 0 : -1}
          onClick={() => onSelect(CENTRE)}
        >
          <span className="h-tile__code" aria-hidden="true">
            IN
          </span>
          <span className="h-rajya__centrename" aria-hidden="true">
            {t('Centre', 'केंद्र')}
          </span>
          {centreState === 'cleared' ? <Check className="h-tile__glyph" aria-hidden="true" size={14} strokeWidth={3.2} /> : null}
          {centreState === 'progress' ? (
            <>
              <span className="h-tile__frac" aria-hidden="true">
                {centre.cleared}/{centre.total}
              </span>
              <span className="h-tile__bar" aria-hidden="true">
                <span style={{ width: `${centre.total ? (centre.cleared / centre.total) * 100 : 0}%` }} />
              </span>
            </>
          ) : null}
          {centreState === 'sealed' ? <span className="h-tile__tape" aria-hidden="true" /> : null}
        </button>
      </div>
    </div>
  );
}

function Legend() {
  const { t } = useLang();
  return (
    <ul className="h-rajya__legend" aria-label={t('Legend', 'संकेत')}>
      <li>
        <span className="h-rajya__key h-rajya__key--sealed" aria-hidden="true">
          <span />
        </span>
        <span>
          <strong>{t('Sealed', 'सील')}</strong> {t('· tape cut on first card', '· पहले कार्ड पर फ़ीता कटेगा')}
        </span>
      </li>
      <li>
        <span className="h-rajya__key h-rajya__key--progress" aria-hidden="true">
          <span className="h-mono">3/6</span>
          <span className="h-rajya__keybar" />
        </span>
        <span>
          <strong>{t('Open', 'जारी')}</strong> {t('· cards answered', '· जवाब दिए कार्ड')}
        </span>
      </li>
      <li>
        <span className="h-rajya__key h-rajya__key--cleared" aria-hidden="true">
          <Check size={14} strokeWidth={3.2} />
        </span>
        <span>
          <strong>{t('Cleared', 'क्लियर')}</strong> {t('· all six answered', '· छहों के जवाब')}
        </span>
      </li>
      <li>
        <span className="h-rajya__key h-rajya__key--centre" aria-hidden="true">
          IN
        </span>
        <span>
          <strong>{t('Centre', 'केंद्र')}</strong> {t('· the Union’s sector files', '· केंद्र की सेक्टर फ़ाइलें')}
        </span>
      </li>
    </ul>
  );
}

/** Desktop tile search: dims the drawers that do not match; Enter opens the first match's brief. */
function TileSearch({ drawers, query, onQuery, onPick }: { drawers: Map<string, Drawer>; query: string; onQuery: (q: string) => void; onPick: (code: string) => void }) {
  const { t } = useLang();
  const id = useId();
  const hits = [...drawers.values()].filter((d) => matches(d, query));
  return (
    <form
      className="h-rajya__search h-rajya__search--tiles"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (query.trim() && hits[0]) onPick(hits[0].code);
      }}
    >
      <label htmlFor={id} className="h-rajya__searchlabel">
        {t('Find a state', 'राज्य खोजो')}
      </label>
      <span className="h-rajya__searchbox">
        <Search size={18} strokeWidth={2.4} aria-hidden="true" />
        <input id={id} type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="UP, Kerala…" autoComplete="off" enterKeyHint="go" />
      </span>
      {query.trim() ? (
        <span className="h-rajya__searchhits h-meta" role="status">
          {hits.length ? t(`${hits.length} match · Enter opens the first`, `${hits.length} मिले`) : t('No drawer matches.', 'कोई दराज़ नहीं मिली।')}
        </span>
      ) : null}
    </form>
  );
}

// ---- the file brief ------------------------------------------------------------------------------------

type BriefProps = {
  drawer: Drawer | null;
  centre: ReturnType<typeof centreSummary>;
  loaded: boolean;
  isHi: boolean;
};

const Brief = function Brief({ drawer, centre, loaded, isHi, ref }: BriefProps & { ref?: Ref<HTMLElement> }) {
  const { t } = useLang();
  const headId = useId();
  if (!loaded)
    return (
      <aside className="h-rajya__side" ref={ref}>
        <Skeleton lines={5} label={t('Opening the file', 'फ़ाइल खुल रही है')} />
      </aside>
    );
  if (!drawer) {
    // The Centre drawer.
    return (
      <aside className="h-rajya__side" ref={ref} aria-labelledby={headId}>
        <section className="h-file h-file--open h-rajya__brief">
          <span className="h-file__tab">F.No. S/IN</span>
          <div className="h-rajya__briefhead">
            <p className="h-rajya__briefhi" lang="hi">
              केंद्र
            </p>
            <h2 className="h-rajya__brieftitle" id={headId} lang={isHi ? 'hi' : 'en'}>
              {t('The Centre', 'केंद्र')}
            </h2>
          </div>
          <p className="h-rajya__briefline">
            {t(
              `The Union’s cards are filed by sector: ${centre.total} Sector Files, plus Kiska Media? and Forward Court.`,
              `केंद्र के कार्ड सेक्टर के हिसाब से: ${centre.total} सेक्टर फ़ाइलें, साथ में किसका मीडिया? और फ़ॉरवर्ड अदालत।`,
            )}
          </p>
          <Meter
            as="div"
            className="h-rajya__briefmeter"
            value={centre.cleared}
            max={Math.max(1, centre.total)}
            label={t('Sector files cleared', 'सेक्टर फ़ाइलें क्लियर')}
            valueText={`${centre.cleared} of ${centre.total} sector files cleared`}
            copy={t(`${centre.cleared} of ${centre.total} sector files cleared`, `${centre.cleared}/${centre.total} सेक्टर फ़ाइलें क्लियर`)}
          />
          <Button variant="primary" block href={href.files('sectors')}>
            {t('Open Sector Files', 'सेक्टर फ़ाइलें खोलो')}
          </Button>
        </section>
      </aside>
    );
  }
  const { route: r, status } = drawer;
  if (!r)
    return (
      <aside className="h-rajya__side" ref={ref} aria-labelledby={headId}>
        <section className="h-file h-file--sealed h-rajya__brief">
          <span className="h-file__tab">F.No. S/{drawer.code}</span>
          <div className="h-rajya__briefhead">
            <p className="h-rajya__briefhi" lang="hi">
              {drawer.nameHi}
            </p>
            <h2 className="h-rajya__brieftitle" id={headId} lang="en">
              {drawer.name}
            </h2>
          </div>
          <p className="h-rajya__briefline">{t('This file is being typed. Babu will file it soon.', 'यह फ़ाइल टाइप हो रही है। बाबू जल्द फ़ाइल करेंगे।')}</p>
        </section>
      </aside>
    );
  const sectors = r.topics;
  return (
    <aside className="h-rajya__side" ref={ref} aria-labelledby={headId}>
      <section className={cx('h-file', status.state === 'cleared' ? 'h-file--cleared' : status.state === 'progress' ? 'h-file--open' : 'h-file--sealed', 'h-rajya__brief')}>
        <span className="h-file__tab">{fileNo(r)}</span>
        <div className="h-rajya__briefhead">
          <div className="h-rajya__brieftitles">
            <p className="h-rajya__briefhi" lang="hi">
              {drawer.nameHi}
            </p>
            <h2 className="h-rajya__brieftitle" id={headId} lang="en">
              {drawer.name}
            </h2>
          </div>
        </div>
        <div className="h-rajya__statusrow">
          <p className="h-rajya__briefstatus">{statusWords(status, t)}</p>
          {status.state === 'cleared' ? (
            <span className="h-rajya__stamp">
              <Stamp kind="noted" seed={r.id} text="CLEARED" size="l" label={t('File cleared', 'फ़ाइल क्लियर')} />
            </span>
          ) : null}
        </div>
        {status.state === 'sealed' ? <Tape /> : null}
        {status.running ? (
          <Meter value={status.done} max={CARDS} ticks={CARDS} label={t('Cards answered', 'जवाब दिए कार्ड')} valueText={`${status.done} of ${CARDS} answered`} />
        ) : null}
        <dl className="h-rajya__facts">
          <div>
            <dt>{t('Cards', 'कार्ड')}</dt>
            <dd>{stateCardsLine(r, t)}</dd>
          </div>
          <div>
            <dt>{t('Sectors', 'सेक्टर')}</dt>
            <dd>
              {sectors.map((s, i) => (
                <span key={s}>
                  {i ? ' · ' : ''}
                  {isHi && SECTOR_NAMES_HI[s] ? <span lang="hi">{SECTOR_NAMES_HI[s]}</span> : s}
                </span>
              ))}
            </dd>
          </div>
          {status.best ? (
            <div>
              <dt>{t('Best', 'सर्वश्रेष्ठ')}</dt>
              <dd className="h-mono">{bestText(status.best).replace(/^Best /, '')}</dd>
            </div>
          ) : null}
        </dl>
        <Button variant="primary" block href={href.online()}>{t('Find a human duel', 'इंसानी मुक़ाबला ढूँढ़ो')}</Button>
        <Button variant="paper" block href={href.route(r.id)}>
          {openWords(status, t)}
        </Button>
      </section>
    </aside>
  );
};

/** Phone list view: the selected (or last opened) file's one action above the list. */
function QuickOpen({ drawer, loaded }: { drawer: Drawer | null; loaded: boolean }) {
  const { t } = useLang();
  if (!loaded || !drawer?.route) return null;
  return (
    <Button variant="primary" block href={href.route(drawer.route.id)}>
      {openWords(drawer.status, t)} · {drawer.name}
    </Button>
  );
}

// ---- the list view -------------------------------------------------------------------------------------

function StateList({
  drawers,
  centre,
  query,
  onQuery,
}: {
  drawers: Map<string, Drawer>;
  centre: ReturnType<typeof centreSummary>;
  query: string;
  onQuery: (q: string) => void;
}) {
  const { t } = useLang();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const rows = [...drawers.values()].sort((a, b) => a.name.localeCompare(b.name, 'en')).filter((d) => matches(d, draft));
  const centreHit = matches({ code: CENTRE, name: 'Centre', nameHi: 'केंद्र' }, draft);
  const listed = rows.length + (centreHit ? 1 : 0);
  return (
    <div className="h-rajya__listwrap">
      <form className="h-rajya__search" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor={id} className="h-rajya__searchlabel">
          {t('Search the drawers', 'दराज़ें खोजो')}
        </label>
        <span className="h-rajya__searchbox">
          <Search size={18} strokeWidth={2.4} aria-hidden="true" />
          <input
            ref={input}
            id={id}
            type="search"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onQuery(e.target.value);
            }}
            placeholder={t('State name or code', 'राज्य का नाम या कोड')}
            autoComplete="off"
          />
        </span>
      </form>
      <p className="h-sr" role="status" aria-live="polite">
        {t(`${listed} ${listed === 1 ? 'file' : 'files'} listed`, `${listed} ${listed === 1 ? 'फ़ाइल' : 'फ़ाइलें'}`)}
      </p>
      {rows.length || centreHit ? (
        <ul className="h-rajya__list">
          {centreHit ? (
            <li>
              <Link to={href.files('sectors')} className="h-rajya__row">
                <span className="h-rajya__rowcode h-mono" aria-hidden="true">
                  IN
                </span>
                <span className="h-rajya__rowmain">
                  <span className="h-rajya__rowname">
                    {t('Centre', 'केंद्र')} <span lang="hi">· केंद्र</span>
                  </span>
                  <span className="h-rajya__rowmeta">
                    {t(`${centre.total} sector files · ${centre.cleared} cleared`, `${centre.total} सेक्टर फ़ाइलें · ${centre.cleared} क्लियर`)}
                  </span>
                </span>
                <ChevronRight size={20} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            </li>
          ) : null}
          {rows.map((d) => (
            <li key={d.code}>
              <StateRow drawer={d} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="h-rajya__none">{t(`No drawer matches “${draft}”. Try the code — UP, WB, TN.`, `“${draft}” से कोई दराज़ नहीं मिली। कोड आज़माओ — UP, WB, TN।`)}</p>
      )}
    </div>
  );
}

function StateRow({ drawer }: { drawer: Drawer }) {
  const { t } = useLang();
  const { route: r, status } = drawer;
  const inner = (
    <>
      <span className="h-rajya__rowcode h-mono" aria-hidden="true">
        {drawer.code}
      </span>
      <span className="h-rajya__rowmain">
        <span className="h-rajya__rowname">
          {drawer.name} <span lang="hi">· {drawer.nameHi}</span>
        </span>
        <span className="h-rajya__rowmeta">{r ? stateCardsLine(r, t) : t('Being typed.', 'टाइप हो रही है।')}</span>
      </span>
      <span className={cx('h-rajya__rowstate', `h-rajya__rowstate--${status.state}`)}>
        {status.state === 'cleared' ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : status.state === 'sealed' ? <span className="h-rajya__rowtape" aria-hidden="true" /> : null}
        {status.state === 'progress' ? `${status.done}/${CARDS}` : status.state === 'cleared' ? t('Cleared', 'क्लियर') : t('Sealed', 'सील')}
      </span>
      <ChevronRight size={20} strokeWidth={2.4} aria-hidden="true" />
    </>
  );
  if (!r)
    return (
      <div className="h-rajya__row h-rajya__row--nofile">
        {inner}
      </div>
    );
  return (
    <Link to={href.route(r.id)} className="h-rajya__row">
      {inner}
    </Link>
  );
}
