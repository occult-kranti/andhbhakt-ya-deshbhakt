/**
 * screens/room/index.tsx — #/room: a duel against Babu-Bot · BOT (bible §11.10–§11.12).
 *
 * The setup screen's "Start vs Babu-Bot" tap leaves a one-shot intent (duel/lib.ts startBot) and
 * comes here; this screen takes it once, creates the match through the duel controller
 * (`useDuel(request)` — ENGINE §6.3, the in-page duel service over the civics bank) and renders it
 * with the shared Arena. A reload finds no intent and says so: duels live in this tab only, and a new
 * one is never started by itself. Every settled round and the match are filed to the profile with
 * `useRecordRoom(room, epoch)` (ENGINE §6.5), the epoch captured when the match was created.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '@/lib/duel-client';
import { BOT_LINE, BOT_LINE_HI, BOT_NAME } from '../../data';
import { href, navigate, type ScreenProps } from '../../router';
import { useChrome, useScreenTitle } from '../../shell/chrome';
import { useAppPlayer, useRecordRoom } from '../../shell/player';
import { useDuel } from '../../use-duel';
import { Button } from '../../ui/button';
import { useLang } from '../../ui/lang';
import { EmptyState, ErrorState, Page, ScreenHeader } from '../../ui/page';
import { seatNameFor, takeBotIntent, type BotIntent } from '../duel/lib';
import { Arena } from './arena';
import { leaveMatch } from './leave-match';
import { baselineOf, type Baseline } from './result';
import type { Room } from './lib';

export default function RoomScreen(_props: ScreenProps) {
  const [intent] = useState(() => takeBotIntent());
  return intent ? <BotRoom intent={intent} /> : <NoRoom />;
}

function setupHref(intent: BotIntent) {
  return href.duel({ vs: 'bot', mode: intent.config.mode, topic: intent.config.topic });
}

function BotRoom({ intent }: { intent: BotIntent }) {
  const { t } = useLang();
  const player = useAppPlayer();
  const { controller, snapshot } = useDuel(request);
  const [epoch, setEpoch] = useState<string | undefined>(undefined);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(false);
  const room = (snapshot?.room ?? null) as Room | null;
  useRecordRoom(room, epoch);
  useScreenTitle(t('Duel vs Babu-Bot', 'बाबू-बॉट से मुक़ाबला'));

  const start = useCallback(async () => {
    controller.reset();
    setFailed(null);
    const e = player.epoch();
    setEpoch(e);
    setBaseline(baselineOf(player.progression));
    try {
      await controller.createBot({ name: seatNameFor(intent.name), config: intent.config, profileEpoch: e });
    } catch (err) {
      setFailed((err as Error)?.message || 'error');
    }
  }, [controller, intent, player]);

  // One match per tap on the setup screen: created once the profile has loaded (so its epoch is real).
  useEffect(() => {
    if (started.current || !player.loaded) return;
    started.current = true;
    void start();
  }, [player.loaded, start]);

  if (failed && !room)
    return (
      <Page width="play" screen="room">
        <ErrorState detail={failed} onRetry={() => void start()} />
        <div>
          <Button variant="primary" href={setupHref(intent)}>
            {t('Back to Muqabla', 'मुक़ाबले पर वापस')}
          </Button>
        </div>
      </Page>
    );

  return (
    <section className="h-roomscreen" data-screen="room">
      <Arena
        controller={controller}
        snapshot={snapshot}
        kind="bot"
        baseline={baseline}
        onRematch={() => void start()}
        onExit={() => navigate(setupHref(intent))}
        onLeave={() => void leaveMatch(controller, () => navigate(setupHref(intent)))}
        countdownNote={
          <p>
            <strong>{BOT_NAME}</strong> — {t(BOT_LINE, BOT_LINE_HI)}
          </p>
        }
      />
    </section>
  );
}

/** #/room without a match: a reload, or a link. Nothing starts by itself. */
function NoRoom() {
  const { t } = useLang();
  useChrome('full');
  useScreenTitle(t('No duel open', 'कोई मुक़ाबला खुला नहीं'));
  return (
    <Page width="read" screen="room-empty">
      <ScreenHeader
        kicker="F.No. M/—"
        titleHi="मुक़ाबला"
        title={t('No duel open', 'कोई मुक़ाबला खुला नहीं')}
      />
      <EmptyState
        line={t(
          'Duels live in this tab only — a reload closes them. Babu-Bot is still at his desk.',
          'मुक़ाबले सिर्फ़ इसी टैब में चलते हैं — रीलोड से बंद हो जाते हैं। बाबू-बॉट अब भी अपनी मेज़ पर है।',
        )}
        action={
          <Button variant="primary" href={href.duel()}>
            {t('Set up a duel', 'मुक़ाबला तय करें')}
          </Button>
        }
      />
    </Page>
  );
}
