import type { Command, StepConfig } from "@/types/index.ts";

import { getStepTokens } from "@/runtime-config/index.ts";

import { buildPatternSummary } from "./patterns.ts";
import { buildSimpleSummary } from "./simple.ts";

export function buildSummary(step: StepConfig, cmd: Command): string {
  if (cmd.exitCode === 0 && step.passMsg !== undefined) return step.passMsg;

  const { summary } = step;

  if (!summary || summary.type === "simple") {
    return buildSimpleSummary(step, cmd);
  }

  return buildPatternSummary(summary, cmd, getStepTokens(step));
}
