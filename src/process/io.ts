import type { Command, KillableProcess } from "../types/index.ts";

import {
  appendTimedOutDrainMessage,
  appendTimedOutMessage,
  createDelay,
} from "../timeout.ts";
import { flushCollectors, type ProcessCollectors } from "./collectors.ts";
import { terminateProcess } from "./termination.ts";

export async function buildCompletedCommand(
  collectors: ProcessCollectors,
  exitCode: number,
  startMs: number,
): Promise<Command> {
  await flushCollectors([
    collectors.stdoutCollector,
    collectors.stderrCollector,
  ]);
  return {
    durationMs: Date.now() - startMs,
    exitCode,
    output: `${collectors.stdoutCollector.getOutput()}${collectors.stderrCollector.getOutput()}`,
    timedOut: false,
  };
}

export async function buildTimedOutCommand(
  child: KillableProcess,
  collectors: ProcessCollectors,
  startMs: number,
  timeout: { drainMs: number; label: string; timeoutMs: number },
): Promise<Command> {
  await terminateProcess(child);
  const didFlushOutput = await flushCollectors(
    [collectors.stdoutCollector, collectors.stderrCollector],
    timeout.drainMs,
  );
  let output = appendTimedOutMessage(
    `${collectors.stdoutCollector.getOutput()}${collectors.stderrCollector.getOutput()}`,
    timeout.label,
    timeout.timeoutMs,
  );
  if (!didFlushOutput) {
    output = appendTimedOutDrainMessage(output, timeout.label, timeout.drainMs);
  }
  return {
    durationMs: Date.now() - startMs,
    exitCode: 124,
    output,
    timedOut: true,
  };
}

export async function waitForProcessOutcome(
  child: KillableProcess,
  timeoutMs?: number,
): Promise<{ exitCode: number; kind: "exit" } | { kind: "timeout" }> {
  const exitPromise = child.exited.then((exitCode) => ({
    exitCode: exitCode ?? 1,
    kind: "exit" as const,
  }));
  if (!timeoutMs || timeoutMs <= 0) {
    return exitPromise;
  }

  const timeoutDelay = createDelay(timeoutMs, { kind: "timeout" as const });
  try {
    return await Promise.race([exitPromise, timeoutDelay.promise]);
  } finally {
    timeoutDelay.cancel();
  }
}
