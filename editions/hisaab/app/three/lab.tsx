/**
 * three/lab.tsx — ThreeLab, the hidden set-piece lab (mount at #/dev/three; never linked).
 *
 * Each of TIJORI, TARAZU, THAPPA and FILE PILE with presets, a replay, a 2D switch, a "live round"
 * switch (SceneHost must refuse to mount), and rough frame stats from the scene (first frame, settle
 * time, JS per frame, rAF interval, draw calls, triangles, bodies). Reduced motion follows the Effects
 * setting / the OS. Query (in the hash): ?piece=tijori|tarazu|thappa|pile|all&preset=<n>&mode=2d.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useQuietRound } from '../budget';
import { Button } from '../ui/button';
import { Page, ScreenHeader } from '../ui/page';
import type { StampKind } from '../ui/stamp';
import { FilePile, type FileResult } from './file-pile';
import { sceneCapability, sceneReduced, threeStats, type SceneStats, type SetPiece } from './runtime';
import { Tarazu } from './tarazu';
import { Thappa } from './thappa';
import { Tijori } from './tijori';
import './lab.css';

type Piece = SetPiece | 'all';

const TIJORI_PRESETS = [
  { label: '214 · +3 new', count: 214, fresh: 3 },
  { label: '7 · +7 new', count: 7, fresh: 7 },
  { label: '38 · +12 new', count: 38, fresh: 12 },
  { label: '1,250 · +2', count: 1250, fresh: 2 },
  { label: '0', count: 0, fresh: 0 },
] as const;

const TARAZU_PRESETS: { label: string; scores: [number, number]; winner: 0 | 1 | null; names: [string, string] }[] = [
  { label: 'You 2–1', scores: [2, 1], winner: 0, names: ['You', 'Babu-Bot · BOT'] },
  { label: 'Bot 2–0', scores: [0, 2], winner: 1, names: ['You', 'Babu-Bot · BOT'] },
  { label: 'Draw 2–2', scores: [2, 2], winner: null, names: ['Asha', 'Bilal'] },
  { label: 'Gauntlet 5–0', scores: [5, 0], winner: 0, names: ['You', 'Friend'] },
  { label: 'Quick 1–0', scores: [1, 0], winner: 0, names: ['You', 'Babu-Bot · BOT'] },
];

const THAPPA_PRESETS: { label: string; text: string; kind: StampKind }[] = [
  { label: 'Issued', text: 'ISSUED · RECEIPT MAANGO', kind: 'noted' },
  { label: 'Filed 4/5', text: 'FILED · 4/5', kind: 'noted' },
  { label: 'Waah Waah', text: 'WAAH WAAH', kind: 'pass' },
  { label: 'Galat', text: 'GALAT · OBJECTION', kind: 'fail' },
];

const PILE_PRESETS: { label: string; title: string; results: FileResult[]; score: { got: number; max: number } }[] = [
  { label: 'UP 18/24', title: 'Uttar Pradesh', results: ['pass', 'pass', 'fail', 'pass', 'wait', 'pass'], score: { got: 18, max: 24 } },
  { label: 'All right', title: 'Welfare & Subsidies', results: ['pass', 'pass', 'pass', 'pass', 'pass', 'pass'], score: { got: 24, max: 24 } },
  { label: 'Rough', title: 'Kiska Media?', results: ['fail', 'pass', 'fail', 'wait', 'fail', 'pass'], score: { got: -3, max: 24 } },
];

function readQuery(): URLSearchParams {
  if (typeof location === 'undefined') return new URLSearchParams();
  const h = location.hash;
  const i = h.indexOf('?');
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '');
}

const useStats = () =>
  useSyncExternalStore(
    threeStats.subscribe,
    () => JSON.stringify(threeStats.all()),
    () => '[]',
  );

const ms = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n.toFixed(1)} ms`);

function StatsTable() {
  const raw = useStats();
  const rows = useMemo(() => JSON.parse(raw) as SceneStats[], [raw]);
  if (!rows.length) return <p className="h-lab__note">No 3D scene has drawn yet (2D art, a live round, or loading).</p>;
  return (
    <table className="h-lab__stats" data-lab-stats="">
      <thead>
        <tr>
          <th scope="col">piece</th>
          <th scope="col">first frame</th>
          <th scope="col">settle</th>
          <th scope="col">rest (reduced)</th>
          <th scope="col">frames</th>
          <th scope="col">JS avg / max</th>
          <th scope="col">rAF avg / max</th>
          <th scope="col">draw calls</th>
          <th scope="col">tris</th>
          <th scope="col">bodies</th>
          <th scope="col">dpr</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.piece} data-piece={r.piece}>
            <th scope="row">{r.piece}</th>
            <td>{ms(r.firstFrameMs)}</td>
            <td>{ms(r.settleMs)}</td>
            <td>{ms(r.restMs)}</td>
            <td>{r.frames}</td>
            <td>
              {ms(r.jsAvgMs)} / {ms(r.jsMaxMs)}
            </td>
            <td>
              {ms(r.frameAvgMs)} / {ms(r.frameMaxMs)}
            </td>
            <td>{r.drawCalls}</td>
            <td>{r.triangles}</td>
            <td>{r.bodies}</td>
            <td>{r.dpr}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; text: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="h-lab__choice">
      <legend>{label}</legend>
      <div className="h-lab__chips">
        {options.map((o) => (
          <button key={String(o.id)} type="button" className="h-lab__chip" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>
            {o.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function ThreeLab() {
  const q = useMemo(readQuery, []);
  const [piece, setPiece] = useState<Piece>(((q.get('piece') as Piece) || 'tijori') as Piece);
  const [preset, setPreset] = useState(Number(q.get('preset') ?? 0) || 0);
  const [flat, setFlat] = useState(q.get('mode') === '2d');
  const [live, setLive] = useState(q.get('live') === '1');
  const [run, setRun] = useState(0);
  useQuietRound(live);
  const cap = sceneCapability();
  const reduced = sceneReduced();

  const pick = (p: Piece) => {
    setPiece(p);
    setPreset(0);
  };

  const show = (p: SetPiece) => piece === p || piece === 'all';
  const t = TIJORI_PRESETS[Math.min(preset, TIJORI_PRESETS.length - 1)];
  const z = TARAZU_PRESETS[Math.min(preset, TARAZU_PRESETS.length - 1)];
  const s = THAPPA_PRESETS[Math.min(preset, THAPPA_PRESETS.length - 1)];
  const f = PILE_PRESETS[Math.min(preset, PILE_PRESETS.length - 1)];
  const presets =
    piece === 'tijori' ? TIJORI_PRESETS : piece === 'tarazu' ? TARAZU_PRESETS : piece === 'thappa' ? THAPPA_PRESETS : piece === 'pile' ? PILE_PRESETS : [];

  return (
    <Page screen="dev-three" className="h-lab">
      <ScreenHeader kicker="F.No. DEV/3D" titleHi="ठप्पा लैब" title="Set-piece lab" lead="TIJORI, TARAZU, THAPPA and FILE PILE, each over its true numbers. Hidden; not a product screen." />
      <div className="h-lab__controls">
        <Choice<Piece>
          label="Piece"
          value={piece}
          onChange={pick}
          options={[
            { id: 'tijori', text: 'Tijori' },
            { id: 'tarazu', text: 'Tarazu' },
            { id: 'thappa', text: 'Thappa' },
            { id: 'pile', text: 'File pile' },
            { id: 'all', text: 'All (one canvas)' },
          ]}
        />
        {presets.length ? (
          <Choice<number> label="Preset" value={preset} onChange={setPreset} options={presets.map((p, i) => ({ id: i, text: p.label }))} />
        ) : null}
        <div className="h-lab__row">
          <Button variant="paper" size="s" onClick={() => setRun((n) => n + 1)} trailing={null}>
            Replay
          </Button>
          <Button variant="paper" size="s" onClick={() => setFlat((v) => !v)} aria-pressed={flat} trailing={null}>
            {flat ? '2D forced' : 'Allow 3D'}
          </Button>
          <Button variant="ghost" size="s" onClick={() => setLive((v) => !v)} aria-pressed={live} trailing={null}>
            {live ? 'Live round: ON' : 'Live round: off'}
          </Button>
        </div>
        <p className="h-lab__note" data-lab-cap={cap.ok ? 'ok' : cap.reason}>
          Capability: {cap.ok ? 'ok' : cap.reason} · motion: {reduced ? 'reduced (one settled frame; THAPPA → 2D)' : 'full'}
          {live ? ' · live: every host shows 2D' : ''}
        </p>
      </div>

      <div className="h-lab__stage" key={`${piece}-${preset}-${run}-${flat ? 1 : 0}`}>
        {show('tijori') ? (
          <section className="h-lab__panel" aria-label="Tijori">
            <h2 className="h-lab__h2">Tijori</h2>
            <Tijori count={t.count} newCount={t.fresh} trigger="mount" scene={flat ? null : undefined} />
          </section>
        ) : null}
        {show('tarazu') ? (
          <section className="h-lab__panel" aria-label="Tarazu">
            <h2 className="h-lab__h2">Tarazu</h2>
            <Tarazu scores={z.scores} names={z.names} winner={z.winner} scene={flat ? null : undefined} />
          </section>
        ) : null}
        {show('thappa') ? (
          <section className="h-lab__panel h-stamp-stage" aria-label="Thappa">
            <h2 className="h-lab__h2">Thappa</h2>
            <Thappa text={s.text} kind={s.kind} seed={`lab-${s.label}`} scene={flat ? null : undefined} />
          </section>
        ) : null}
        {show('pile') ? (
          <section className="h-lab__panel h-stamp-stage" aria-label="File pile">
            <h2 className="h-lab__h2">File pile</h2>
            <FilePile results={f.results} title={f.title} score={f.score} scene={flat ? null : undefined} />
          </section>
        ) : null}
      </div>

      <section className="h-lab__panel" aria-label="Frame stats">
        <h2 className="h-lab__h2">Frame stats (rough)</h2>
        <StatsTable />
      </section>
    </Page>
  );
}
