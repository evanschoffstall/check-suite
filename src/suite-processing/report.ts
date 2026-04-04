import type { Command, StepConfig } from "../types/index.ts";
import type { CheckRow, ProcessedResultEntry } from "./types.ts";

import { buildProcessedResults, collectMissingSteps } from "./processed-results.ts";
import { buildCheckRows } from "./rows.ts";

/** Builds the full post-run suite report: processed results, check rows, and missing-step names. */
export async function prepareSuiteReport(executionState: {
  allExecutedSteps: StepConfig[];
  executedMainSteps: StepConfig[];
  runs: Record<string, Command>;
  suiteExpiredBeforeOutput: boolean;
}): Promise<{
  checks: CheckRow[];
  missingSteps: string[];
  processedResults: Record<string, ProcessedResultEntry>;
}> {
  const processedResults = await buildProcessedResults(
    executionState.allExecutedSteps,
    executionState.runs,
    executionState.suiteExpiredBeforeOutput,
  );

  return {
    checks: buildCheckRows(
      executionState.executedMainSteps,
      executionState.runs,
      processedResults,
    ),
    missingSteps: collectMissingSteps(
      executionState.allExecutedSteps,
      executionState.runs,
    ),
    processedResults,
  };
}
