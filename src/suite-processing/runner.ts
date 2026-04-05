import { CFG, SUITE_LABEL, SUITE_TIMEOUT_MS } from "@/runtime-config/index.ts";

import {
  printSuiteOutputs,
  printSuitePostProcessFeedback,
  printSuiteSummary,
  startSuiteProgress,
} from "./display.ts";
import { executeSuiteSteps } from "./execution.ts";
import { prepareSuiteReport } from "./report.ts";
import { selectSuiteSteps } from "./selection.ts";

/** Runs the configured quality suite with optional step filtering and summary mode. */
export async function runCheckSuite(
  keyFilter?: null | Set<string>,
  options: { excludedKeys?: ReadonlySet<string>; summaryOnly?: boolean } = {},
): Promise<void> {
  const startedAtMs = Date.now();
  const deadlineMs = startedAtMs + SUITE_TIMEOUT_MS;
  const excludedKeys = options.excludedKeys ?? new Set<string>();
  const summaryOnly = options.summaryOnly === true;
  startSuiteProgress(summaryOnly);
  const { mainSteps, preRunSteps } = selectSuiteSteps(
    CFG.steps,
    keyFilter,
    excludedKeys,
  );
  const executionState = await executeSuiteSteps(
    preRunSteps,
    mainSteps,
    deadlineMs,
  );
  const report = await prepareSuiteReport(executionState);

  printSuiteReport(
    executionState,
    report.processedResults,
    summaryOnly,
    report.missingSteps,
  );

  const allOk =
    printSuiteSummary(report.checks, executionState.runs, startedAtMs) &&
    !executionState.timedOut;
  completeSuiteRun(allOk, executionState.timedOut);
}

function completeSuiteRun(allOk: boolean, timedOut: boolean): void {
  if (timedOut) {
    console.error(
      `Check command failed: ${SUITE_LABEL} exceeded the ${(SUITE_TIMEOUT_MS / 1000).toFixed(2)}-second overall timeout. Please try again.`,
    );
    process.exit(1);
  }
  if (!allOk) process.exit(1);
}

function printSuiteReport(
  executionState: Awaited<ReturnType<typeof executeSuiteSteps>>,
  processedResults: Awaited<
    ReturnType<typeof prepareSuiteReport>
  >["processedResults"],
  summaryOnly: boolean,
  missingSteps: Awaited<ReturnType<typeof prepareSuiteReport>>["missingSteps"],
): void {
  printSuiteOutputs(
    executionState.allExecutedSteps,
    executionState.runs,
    processedResults,
    executionState.suiteExpiredBeforeOutput,
    summaryOnly,
  );
  printSuitePostProcessFeedback(
    executionState.executedMainSteps,
    processedResults,
    executionState.suiteExpiredBeforeOutput,
    summaryOnly,
    missingSteps,
  );
}
