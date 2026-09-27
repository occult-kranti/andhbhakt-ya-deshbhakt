import type { DuelController } from '../../use-duel';

/** Give the peer notification a short chance to arrive, then always release the player. */
export async function leaveMatch(controller: DuelController, exit: () => void) {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      controller.leave().catch(() => {}),
      new Promise<void>((resolve) => { deadline = setTimeout(resolve, 750); }),
    ]);
  } finally {
    clearTimeout(deadline);
    // reset invalidates every in-flight answer, leave and poll before disposing the old transport.
    controller.reset();
    controller.dispose();
    exit();
  }
}
