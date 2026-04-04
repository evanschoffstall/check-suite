import type { Command, StepConfig } from "@/types/index.ts";

import { getStepTokens } from "@/tokens.ts";

import { compactDomAssertionNoise } from "./dom.ts";
import { buildPatternSummary } from "./patterns.ts";
import { buildSimpleSummary } from "./simple.ts";

/** Derives the one-line summary text for a completed step. */
export function buildSummary(step: StepConfig, cmd: Command): string {
  if (cmd.exitCode === 0 && step.passMsg !== undefined) return step.passMsg;

  const { summary } = step;

  if (!summary || summary.type === "simple") {
    return buildSimpleSummary(step, cmd);
  }

  return buildPatternSummary(summary, cmd, getStepTokens(step));
}

export { compactDomAssertionNoise };
