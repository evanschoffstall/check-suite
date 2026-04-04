import type { Command } from "@/types/index.ts";

import { makeTimedOutCommand } from "./messages.ts";

/**
 * Races a step promise against an optional wall-clock timeout.
 * When the timeout fires, returns a `makeTimedOutCommand` result without
 * cancelling the underlying process (the caller owns lifecycle management).
 */
export async function withStepTimeout(
  label: string,
  stepPromise: Promise<Command>,
  timeoutMs?: number,
): Promise<Command> {
  if (timeoutMs === undefined || timeoutMs <= 0) return stepPromise;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      stepPromise,
      new Promise<Command>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve(makeTimedOutCommand(label, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
