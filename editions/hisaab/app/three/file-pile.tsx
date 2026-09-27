/**
 * three/file-pile.tsx — FILE PILE, six files dropping onto a desk at a route finish (bible §10).
 *
 *   <FilePile results={['pass','pass','fail','pass','wait','pass']} title="Uttar Pradesh" score={{ got: 18, max: 24 }} />
 *
 * 3D: six manila covers drop 90 ms apart, each with a front edge in its TRUE result's colour; a red-tape
 * strap comes down and ties the pile; THAPPA stamps FILE CLEARED · 18/24 on the top cover; ≤ 2.2 s, then
 * the loop stops. The title, the stamp line and the six results (icon + word) are printed under it.
 * 2D fallback: six tabs with verdict edges + a tape band + the stamp.
 */
import { Check, Hourglass, X } from 'lucide-react';
import { useEffect } from 'react';
import { useJuice } from '@/components/fx';
import { Stamp } from '../ui/stamp';
import { SceneHost, type SceneComponent } from './scene-host';
import { FilePileScene } from './scenes';

export type FileResult = 'pass' | 'fail' | 'wait';

export type FilePileSceneProps = { results: readonly FileResult[]; title: string; stamp: string };

export type FilePileProps = {
  /** The six cards' TRUE results, in order. */
  results: readonly FileResult[];
  /** The file's name ('Uttar Pradesh', 'Seedha Khaate Mein · 2020–26'). */
  title: string;
  /** Run score for the stamp: FILE CLEARED · 18/24. */
  score?: { got: number; max: number };
  /** Box height; default 260 (phone) / 340 (≥ 900px). */
  height?: number;
  /** Lazy 3D scene; defaults to the Rapier pile. Pass `null` to force the 2D art. */
  scene?: SceneComponent<FilePileSceneProps> | null;
  /** Sound/haptic twins (tick per file, whoosh for the strap, stamp). Default true. */
  cues?: boolean;
  className?: string;
};

const WORD: Record<FileResult, string> = { pass: 'WAAH WAAH', fail: 'GALAT', wait: 'PENDING' };
const ICON = { pass: Check, fail: X, wait: Hourglass } as const;

/** A signed score with a true minus sign (U+2212), never an ASCII hyphen: −4. */
const signed = (n: number) => (n < 0 ? `\u2212${Math.abs(n)}` : String(n));
export const filePileStamp = (score?: { got: number; max: number }) =>
  score ? `FILE CLEARED · ${signed(score.got)}/${score.max}` : 'FILE CLEARED';

export function filePileLabel(title: string, results: readonly FileResult[], score?: { got: number; max: number }) {
  const right = results.filter((r) => r === 'pass').length;
  return `File cleared: ${title}, ${score ? `${signed(score.got)} of ${score.max}` : `${right} of ${results.length} right`}.`;
}

/** The six results as icon + word + count (the colour twin under the 3D pile). */
export function FilePileTally({ results }: { results: readonly FileResult[] }) {
  const kinds = (['pass', 'fail', 'wait'] as const).filter((k) => results.includes(k));
  return (
    <ul className="h-t3__tally" aria-hidden="true">
      {kinds.map((k) => {
        const Icon = ICON[k];
        return (
          <li key={k} className={`h-t3__tally--${k}`}>
            <Icon strokeWidth={3} />
            {results.filter((r) => r === k).length} {WORD[k]}
          </li>
        );
      })}
    </ul>
  );
}

/** Title, stamp line and tally — printed under the 3D pile (and held in place while it loads). */
export function FilePileCaption({ results, title, stamp }: FilePileSceneProps) {
  return (
    <div className="h-t3__caption" aria-hidden="true">
      <p className="h-t3__title">{title}</p>
      <p className="h-t3__line">{stamp}</p>
      <FilePileTally results={results} />
    </div>
  );
}

export function FilePileArt({
  results,
  title,
  score,
  cues = false,
  animate = true,
}: Pick<FilePileProps, 'results' | 'title' | 'score' | 'cues'> & { animate?: boolean }) {
  const juice = useJuice();
  useEffect(() => {
    if (!cues || !animate) return;
    juice.sound('stamp');
    juice.haptic('heavy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="h-pile" aria-hidden="true">
      <div className="h-pile__stack">
        {results.map((r, i) => (
          <span key={i} className={`h-pile__file h-pile__file--${r}`}>
            <span>F.No. {i + 1}/6</span>
            <span>{WORD[r]}</span>
          </span>
        ))}
        <span className="h-pile__tape" />
      </div>
      <p className="h-pile__title">{title}</p>
      <Stamp kind="noted" seed={`pile-${title}`} text={filePileStamp(score)} size="l" animate={animate} />
    </div>
  );
}

export function FilePile({ results, title, score, height, scene, cues = true, className }: FilePileProps) {
  return (
    <SceneHost
      piece="pile"
      label={filePileLabel(title, results, score)}
      fallback={<FilePileArt results={results} title={title} score={score} cues={cues} />}
      after={<FilePileArt results={results} title={title} score={score} animate={false} />}
      loading={
        <div className="h-t3 h-t3--pile">
          <div />
          <FilePileCaption results={results} title={title} stamp={filePileStamp(score)} />
        </div>
      }
      deadlineMs={1800}
      scene={scene === null ? undefined : (scene ?? FilePileScene)}
      props={{ results, title, stamp: filePileStamp(score) }}
      height={height}
      cues={cues}
      className={className}
    />
  );
}
