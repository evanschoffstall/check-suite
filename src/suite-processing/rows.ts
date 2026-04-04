import type { Command, StepConfig } from "../types/index.ts";
import type { CheckRow, ProcessedResultEntry } from "./types.ts";

import { buildSummary } from "../summary.ts";

export function buildCheckRows(
  executedMainSteps: StepConfig[],
  runs: Record<string, Command>,
  processedResults: Record<string, ProcessedResultEntry>,
): CheckRow[] {
  return executedMainSteps.flatMap((step) => {
    const cmd = runs[step.key];
    const processed = processedResults[step.key].postProcess;
    const stepCheck: CheckRow = {
      d: processed?.summary ?? buildSummary(step, cmd),
      k: step.label,
      ms: cmd.durationMs,
      status: processed?.status ?? (cmd.exitCode === 0 ? "pass" : "fail"),
      stpk: step.key,
    };
    const extraChecks = (processed?.extraChecks ?? []).map((check) => ({
      d: check.details,
      k: check.label,
      status: check.status,
      stpk: null,
    }));
    return [stepCheck, ...extraChecks];
  });
}
