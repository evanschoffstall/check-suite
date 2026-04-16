import type { Command } from "@/types/index.ts";

import { formatDuration } from "@/format/index.ts";

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

/** Constructs a synthetic `Command` representing a step that exceeded its timeout. */
export function makeTimedOutCommand(label: string, timeoutMs: number): Command {
  return {
    exitCode: 124,
    output: `${label} exceeded the ${formatDuration(timeoutMs)} timeout\n`,
    timedOut: true,
  };
}
