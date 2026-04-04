import type { Command, KillableProcess, OutputFilter, RunOptions, StreamCollector } from "./types.ts";

import { DECLARED_BUNX_TARGETS } from "./config.ts";
import { stripAnsi } from "./format.ts";
import {
  appendTimedOutDrainMessage,
  appendTimedOutMessage,
  createDelay,
  parsePositiveTimeoutMs,
} from "./timeout.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROCESS_KILL_GRACE_MS = 250;
const STREAM_FLUSH_GRACE_MS = 250;

// ---------------------------------------------------------------------------
// bunx availability guard
// ---------------------------------------------------------------------------

/** Applies the configured output filter rule to raw step output. */
export function applyOutputFilter(filter: OutputFilter, output: string): string {
  return output
    .split(/\r?\n/)
    .filter((line) => !new RegExp(filter.pattern, "i").test(stripAnsi(line)))
    .join("\n")
    .trimEnd();
}

/**
 * Spawns a command, collects stdout and stderr, and enforces an optional
 * wall-clock timeout with graceful termination and partial-output drain.
 */
export async function run(
  cmd: string,
  args: string[],
  options: RunOptions = {},
): Promise<Command> {
  const startMs = Date.now();
  const { extraEnv, label = cmd, timeoutDrainMs, timeoutMs } = options;
  const activeTimeoutDrainMs =
    parsePositiveTimeoutMs(timeoutDrainMs) ?? STREAM_FLUSH_GRACE_MS;

  if (cmd === "bunx" && !isBunxCommandAvailable(args)) {
    const target = getBunxCommandTarget(args) ?? "bunx target";
    return {
      durationMs: 0,
      exitCode: 127,
      notFound: true,
      output: `command not found: ${target}`,
      timedOut: false,
    };
  }

  if (!Bun.which(cmd))
    return {
      durationMs: 0,
      exitCode: 127,
      notFound: true,
      output: `command not found: ${cmd}`,
      timedOut: false,
    };

  const env: Record<string, string | undefined> = {
    ...process.env,
    FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
    NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS ?? "1",
    ...extraEnv,
  };
  delete env.NO_COLOR;

  const child = Bun.spawn([cmd, ...args], {
    cwd: process.cwd(),
    env,
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });

  const stdoutCollector = createStreamCollector(child.stdout);
  const stderrCollector = createStreamCollector(child.stderr);

  const timeoutDelay =
    timeoutMs && timeoutMs > 0
      ? createDelay(timeoutMs, { kind: "timeout" as const })
      : null;

  const exitPromise = child.exited.then((exitCode) => ({
    exitCode,
    kind: "exit" as const,
  }));

  const outcome = await Promise.race(
    timeoutDelay ? [exitPromise, timeoutDelay.promise] : [exitPromise],
  );
  timeoutDelay?.cancel();

  if (outcome.kind === "timeout") {
    const activeTimeoutMs = timeoutMs ?? 1;
    await terminateProcess(child);
    const didFlushOutput = await flushCollectors(
      [stdoutCollector, stderrCollector],
      activeTimeoutDrainMs,
    );
    let output = appendTimedOutMessage(
      `${stdoutCollector.getOutput()}${stderrCollector.getOutput()}`,
      label,
      activeTimeoutMs,
    );
    if (!didFlushOutput) {
      output = appendTimedOutDrainMessage(output, label, activeTimeoutDrainMs);
    }
    return {
      durationMs: Date.now() - startMs,
      exitCode: 124,
      output,
      timedOut: true,
    };
  }

  await flushCollectors([stdoutCollector, stderrCollector]);
  return withMissingDetection({
    durationMs: Date.now() - startMs,
    exitCode: outcome.exitCode,
    output: `${stdoutCollector.getOutput()}${stderrCollector.getOutput()}`,
    timedOut: false,
  });
}

/** Augments a `Command` with `notFound: true` when its output signals a missing binary. */
export function withMissingDetection(result: Command): Command {
  if (!hasMissingSignal(result.output)) return result;
  return { ...result, notFound: true };
}

function createStreamCollector(
  stream: null | ReadableStream<Uint8Array> | undefined,
): StreamCollector {
  let output = "";

  if (!stream) {
    return {
      done: Promise.resolve(),
      getOutput: () => output,
    };
  }

  const done = (async () => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        output += decoder.decode(value, { stream: true });
      }
    } catch {
      // Ignore collector errors so timeouts can still return partial output.
    } finally {
      output += decoder.decode();
      reader.releaseLock();
    }
  })();

  return { done, getOutput: () => output };
}

// ---------------------------------------------------------------------------
// Missing-command detection
// ---------------------------------------------------------------------------

async function flushCollectors(
  collectors: StreamCollector[],
  timeoutMs = STREAM_FLUSH_GRACE_MS,
): Promise<boolean> {
  const delay = createDelay(timeoutMs, false);
  try {
    const outcome = await Promise.race([
      Promise.all(collectors.map((collector) => collector.done)).then(
        () => true,
      ),
      delay.promise,
    ]);
    return outcome;
  } finally {
    delay.cancel();
  }
}

function getBunxCommandTarget(args: string[]): null | string {
  const target = args.find((arg) => !arg.startsWith("-"));
  return target && target.length > 0 ? target : null;
}

// ---------------------------------------------------------------------------
// Output filtering
// ---------------------------------------------------------------------------

function hasExplicitPackageVersion(specifier: string): boolean {
  if (!specifier.startsWith("@")) return specifier.includes("@");

  const slashIndex = specifier.indexOf("/");
  if (slashIndex < 0) return false;
  return specifier.includes("@", slashIndex + 1);
}

// ---------------------------------------------------------------------------
// Stream collection
// ---------------------------------------------------------------------------

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

/** Returns false when a `bunx` target is not declared as a project dependency. */
function isBunxCommandAvailable(args: string[]): boolean {
  const target = getBunxCommandTarget(args);
  if (!target) return true;
  if (hasExplicitPackageVersion(target)) return true;

  const packageName = stripPackageVersion(target);
  return (
    DECLARED_BUNX_TARGETS.has(target) || DECLARED_BUNX_TARGETS.has(packageName)
  );
}

// ---------------------------------------------------------------------------
// Process termination
// ---------------------------------------------------------------------------

function stripPackageVersion(specifier: string): string {
  if (!specifier.startsWith("@"))
    return specifier.split("@", 2)[0] ?? specifier;

  const slashIndex = specifier.indexOf("/");
  if (slashIndex < 0) return specifier;

  const versionIndex = specifier.indexOf("@", slashIndex + 1);
  return versionIndex < 0 ? specifier : specifier.slice(0, versionIndex);
}

// ---------------------------------------------------------------------------
// Subprocess runner
// ---------------------------------------------------------------------------

async function terminateProcess(child: KillableProcess): Promise<void> {
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
    // Ignore hard-kill failures — the caller will still return buffered output.
  }

  const killDelay = createDelay(PROCESS_KILL_GRACE_MS, null);
  try {
    await Promise.race([exited, killDelay.promise]);
  } finally {
    killDelay.cancel();
  }
}
