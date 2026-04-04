import type {
  CheckRow,
  Command,
  ProcessedResultEntry,
  StepConfig,
} from "@/types/index.ts";

import { buildSummary } from "@/summary.ts";

export function buildCheckRows(
  executedMainSteps: StepConfig[],
  runs: Record<string, Command>,
  processedResults: Record<string, ProcessedResultEntry>,
): CheckRow[] {
  return executedMainSteps.flatMap((step) => {
    const cmd = runs[step.key];
    const processed = processedResults[step.key].postProcess;
    const stepCheck: CheckRow = {
      details: processed?.summary ?? buildSummary(step, cmd),
      durationMs: cmd.durationMs,
      label: step.label,
      status: processed?.status ?? (cmd.exitCode === 0 ? "pass" : "fail"),
      stepKey: step.key,
    };
    const extraChecks = (processed?.extraChecks ?? []).map((check) => ({
      details: check.details,
      label: check.label,
      status: check.status,
      stepKey: null,
    }));
    return [stepCheck, ...extraChecks];
  });
}
