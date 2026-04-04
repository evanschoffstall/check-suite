import type { KillableProcess } from "@/types/index.ts";

import { createDelay } from "@/timeout/index.ts";

const PROCESS_KILL_GRACE_MS = 250;

export async function terminateProcess(child: KillableProcess): Promise<void> {
  try {
    child.kill();
  } catch {
    return;
  }

  const exited = child.exited.catch(() => null);
  const gracefulDelay = createDelay(PROCESS_KILL_GRACE_MS, false);
  const exitedGracefully = await Promise.race([
    exited.then(() => true),
    gracefulDelay.promise,
  ]);
  gracefulDelay.cancel();
  if (exitedGracefully) return;

  try {
    child.kill("SIGKILL");
  } catch {
    return;
  }

  const killDelay = createDelay(PROCESS_KILL_GRACE_MS, null);
  try {
    await Promise.race([exited, killDelay.promise]);
  } finally {
    killDelay.cancel();
  }
}
