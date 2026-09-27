/**
 * shell/top-bar.tsx — `h-top` (bible §5): 56px + safe-area top. Wordmark हिसाब दो (home), the level
 * chip (→ profile), mute, settings. Replaced by the round header in a live room (chrome 'none').
 *
 * The chip names the label (from 600px) only once the player holds a receipt: before that the label is
 * revealed by the inline card after the first receipt, with its one-liner and the first-sighting line
 * (bible §11.1, §4.5), never as a bare tag on the landing or a shared taster. Until then: 'LV 1' alone.
 */
import { useSyncExternalStore } from 'react';
import { Settings, Volume2, VolumeX } from 'lucide-react';
import { getPrefs, setPref, subscribePrefs } from '@/lib/fx/prefs';
import { standing } from '../../edition';
import { labelDisplay } from '../data';
import { href } from '../router';
import { IconButton } from '../ui/button';
import { BrandName } from '../ui/brand';
import { useLang } from '../ui/lang';
import { useAppPlayer } from './player';

type JournalLike = {
  facts?: Readonly<Record<string, unknown>> | null;
  rounds?: ReadonlyArray<{ factId?: unknown } | null | undefined> | null;
} | null | undefined;

/** Does the journal hold at least one receipt (a fact record or a duel round with a bank fact)? */
function holdsReceipt(journal: JournalLike): boolean {
  if (journal?.facts && Object.keys(journal.facts).length > 0) return true;
  return (journal?.rounds ?? []).some((r) => typeof r?.factId === 'string' && r.factId !== '');
}

/** `inert` while a ceremony covers the page (the shell passes it). */
export function TopBar({ inert }: { inert?: boolean }) {
  const { t, isHi } = useLang();
  const player = useAppPlayer();
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
  const s = standing(player.progression?.xp ?? 0);
  const label = labelDisplay(s.band);
  const named = player.loaded && holdsReceipt(player.journal as JournalLike);
  const muted = !prefs.sound;
  return (
    <header className="h-top" inert={inert || undefined}>
      <a className="h-wordmark" href={href.home()} aria-label={t('Hisaab Do — home', 'हिसाब दो — होम')}>
        <span lang="hi" aria-hidden="true">
          हिसाब दो
        </span>
        <BrandName className="h-wordmark__en" />
      </a>
      <span className="h-top__edition">{t('THE PEOPLE’S ACCOUNT', 'जनता का हिसाब')}</span>
      <span className="h-top__spacer" />
      <a
        className="h-levelchip"
        href={href.me()}
        // WCAG 2.5.3 label in name: the name starts with what the chip prints ('LV 7'), so "click LV 7"
        // works for voice control; the full words follow.
        aria-label={
          named
            ? `LV ${s.level}: ${t('Level', 'लेवल')} ${s.level}, ${isHi ? label.hi : label.en}. ${t('Your profile', 'आपकी प्रोफ़ाइल')}`
            : `LV ${player.loaded ? s.level : ''}: ${t('Level', 'लेवल')} ${player.loaded ? s.level : ''}. ${t('Your profile', 'आपकी प्रोफ़ाइल')}`
        }
      >
        <span className="h-levelchip__lv" aria-hidden="true">
          LV {player.loaded ? s.level : '–'}
        </span>
        {named ? (
          <span className="h-levelchip__label" aria-hidden="true" lang={isHi ? 'hi' : undefined}>
            {isHi ? label.hi : label.en}
          </span>
        ) : null}
      </a>
      <IconButton
        label={t('Mute sound', 'आवाज़ बंद')}
        pressed={muted}
        icon={muted ? <VolumeX size={22} strokeWidth={2.2} /> : <Volume2 size={22} strokeWidth={2.2} />}
        onClick={() => setPref('sound', muted)}
      />
      <IconButton label={t('Settings', 'सेटिंग्स')} icon={<Settings size={22} strokeWidth={2.2} />} href={href.settings()} />
    </header>
  );
}
