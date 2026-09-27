import { useEffect, useRef } from 'react';
import { createStopwatch } from '../../engine/scoring.mjs';
import { useLang } from './lang';
import './stopwatch.css';

export type AnswerClock = ReturnType<typeof createStopwatch>;
/** An isolated display: ticking never re-renders a question or its options. */
export function Stopwatch({ clock, lockedMs, practice = false }: { clock: AnswerClock; lockedMs?: number | null; practice?: boolean }) {
  const { t } = useLang();
  const output = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const paint = () => {
      if (output.current) output.current.textContent = `${(Math.floor((lockedMs ?? clock.elapsed()) / 100) / 10).toFixed(1)} s`;
    };
    paint();
    if (lockedMs !== null && lockedMs !== undefined) return;
    const tick = setInterval(paint, 100);
    // Background throttling affects only drawing; time is always sampled from the monotonic clock.
    document.addEventListener('visibilitychange', paint);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', paint); };
  }, [clock, lockedMs]);
  return <div className="h-stopwatch">
    <span className="h-stopwatch__label">{t('STOPWATCH', 'स्टॉपवॉच')}</span>
    <output ref={output} className="h-stopwatch__time" aria-label={t('Elapsed answer time', 'जवाब का समय')} aria-live="off">0.0 s</output>
    <span className="h-stopwatch__bands">{practice ? t('No deadline. Accuracy decides this shared-device game. No profile XP.', 'कोई समय सीमा नहीं। सही जवाब से फ़ैसला। प्रोफ़ाइल XP नहीं।') : t('Correct: <8s 30 XP · <15s 20 XP · 15s+ 10 XP', 'सही: <8s 30 XP · <15s 20 XP · 15s+ 10 XP')}</span>
  </div>;
}
