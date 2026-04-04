import type { Command, StepConfig } from "@/types/index.ts";

import { splitLines } from "@/format/index.ts";

/** Builds the default summary for steps without pattern-based summary configuration. */
export function buildSimpleSummary(step: StepConfig, cmd: Command): string {
  if (cmd.exitCode === 0) {
    return "passed";
  }

  if (cmd.timedOut) {
    return buildTimedOutSummary(step, cmd.output);
  }

  const firstError = splitLines(cmd.output).find(
    (line) => !line.startsWith("$ "),
  );
  return firstError
    ? `${step.failMsg ?? "failed"}: ${firstError}`
    : (step.failMsg ?? "failed");
}

function buildTimedOutSummary(step: StepConfig, output: string): string {
  const timeoutLine =
    splitLines(output)
      .reverse()
      .find((line) => /\btimeout\b/i.test(line)) ??
    `${step.label} exceeded its timeout`;

  return step.failMsg ? `${step.failMsg}: ${timeoutLine}` : timeoutLine;
}
