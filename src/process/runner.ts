import type { Command, RunOptions } from "@/types/index.ts";

import { DECLARED_BUNX_TARGETS } from "@/config/index.ts";
import { stripAnsi } from "@/format/index.ts";
import { parsePositiveTimeoutMs } from "@/timeout/index.ts";

import { createProcessCollectors } from "./collectors.ts";
import {
  buildCompletedCommand,
  buildTimedOutCommand,
  waitForProcessOutcome,
} from "./io.ts";
import { createProcessEnv, getPreflightFailure } from "./preflight.ts";

const STREAM_FLUSH_GRACE_MS = 250;

export async function run(
  cmd: string,
  args: string[],
  options: RunOptions = {},
): Promise<Command> {
  const startMs = Date.now();
  const { extraEnv, label = cmd, timeoutDrainMs, timeoutMs } = options;
  const preflightFailure = getPreflightFailure(
    cmd,
    args,
    DECLARED_BUNX_TARGETS,
  );
  if (preflightFailure) return preflightFailure;

  const child = Bun.spawn([cmd, ...args], {
    cwd: process.cwd(),
    env: createProcessEnv(extraEnv),
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });
  const collectors = createProcessCollectors(child);
  const outcome = await waitForProcessOutcome(child, timeoutMs);

  const result =
    outcome.kind === "timeout"
      ? await buildTimedOutCommand(child, collectors, startMs, {
          drainMs:
            parsePositiveTimeoutMs(timeoutDrainMs) ?? STREAM_FLUSH_GRACE_MS,
          label,
          timeoutMs: timeoutMs ?? 1,
        })
      : await buildCompletedCommand(collectors, outcome.exitCode, startMs);

  return withMissingDetection(result);
}

export function withMissingDetection(result: Command): Command {
  if (!hasMissingSignal(result.output)) return result;
  return { ...result, notFound: true };
}

function hasMissingSignal(output: string): boolean {
  const text = stripAnsi(output);
  return [
    /command not found:/i,
    /\bscript not found\b/i,
    /should be provided by a local binary/i,
    /cannot find package ['"][^'"]+['"]/i,
    /cannot find module ['"][^'"]+['"]/i,
  ].some((pattern) => pattern.test(text));
}
