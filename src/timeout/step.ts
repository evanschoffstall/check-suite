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
  options: {
    onTimeout?: () => void;
  } = {},
): Promise<Command> {
  if (timeoutMs === undefined || timeoutMs <= 0) return stepPromise;

  let timeoutId!: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      stepPromise,
      new Promise<Command>((resolve) => {
        timeoutId = setTimeout(() => {
          options.onTimeout?.();
          resolve(makeTimedOutCommand(label, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}
