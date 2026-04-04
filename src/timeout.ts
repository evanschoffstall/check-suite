import type { Command, DelayHandle } from "./types.ts";

import { formatDuration } from "./format.ts";

// ---------------------------------------------------------------------------
// Positive integer timeout parsing
// ---------------------------------------------------------------------------

/** Appends an output-drain timeout message to partial command output. */
export function appendTimedOutDrainMessage(
  output: string,
  label: string,
  timeoutDrainMs: number,
): string {
  const drainLine = `${label} output drain exceeded the ${formatDuration(timeoutDrainMs)} timeout after termination\n`;
  if (!output.trim()) return drainLine;
  return `${output.endsWith("\n") ? output : `${output}\n`}${drainLine}`;
}

/** Appends a timeout message to partial command output. */
export function appendTimedOutMessage(
  output: string,
  label: string,
  timeoutMs: number,
): string {
  const timeoutLine = makeTimedOutCommand(label, timeoutMs).output;
  if (!output.trim()) return timeoutLine;
  return `${output.endsWith("\n") ? output : `${output}\n`}${timeoutLine}`;
}

// ---------------------------------------------------------------------------
// Deadline helpers
// ---------------------------------------------------------------------------

/** Creates a cancellable promise that resolves to `value` after `ms` milliseconds. */
export function createDelay<T>(ms: number, value: T): DelayHandle<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      timeoutId = undefined;
      resolve(value);
    }, ms);
    timeoutId.unref();
  });

  return {
    cancel() {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    },
    promise,
  };
}

/** Returns the remaining suite budget in milliseconds without clamping. */
export function getRemainingTimeoutMs(deadlineMs: number): number {
  return deadlineMs - Date.now();
}

// ---------------------------------------------------------------------------
// Cancellable delay
// ---------------------------------------------------------------------------

/** Reports whether the overall suite deadline has already been exhausted. */
export function hasDeadlineExpired(deadlineMs: number): boolean {
  return getRemainingTimeoutMs(deadlineMs) <= 0;
}

// ---------------------------------------------------------------------------
// Timed-out command helpers
// ---------------------------------------------------------------------------

/** Constructs a synthetic `Command` representing a step that exceeded its timeout. */
export function makeTimedOutCommand(label: string, timeoutMs: number): Command {
  return {
    exitCode: 124,
    output: `${label} exceeded the ${formatDuration(timeoutMs)} timeout\n`,
    timedOut: true,
  };
}

/**
 * Parses a number or string value into a positive integer millisecond count.
 * Returns `null` when the value is absent, non-positive, or unparseable.
 */
export function parsePositiveTimeoutMs(
  value: number | string | undefined,
): null | number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
  }
  if (typeof value !== "string") return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Resolves the effective timeout from an optional env var, a configured value,
 * and a hard-coded fallback — in that priority order.
 */
export function resolveTimeoutMs(
  envVarName: string,
  configuredMs: number | undefined,
  fallbackMs: number,
): number {
  return (
    (envVarName ? parsePositiveTimeoutMs(process.env[envVarName]) : null) ??
    parsePositiveTimeoutMs(configuredMs) ??
    fallbackMs
  );
}

// ---------------------------------------------------------------------------
// Step timeout wrapper
// ---------------------------------------------------------------------------

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
