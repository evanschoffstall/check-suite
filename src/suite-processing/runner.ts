import type { CheckingIndicatorController } from "@/suite-processing/checking-indicator/index.ts";

import { CFG, SUITE_LABEL, SUITE_TIMEOUT_MS } from "@/runtime-config/index.ts";
import {
  waitForIndicatorPaint,
  withCheckingIndicator,
} from "@/suite-processing/checking-indicator/index.ts";

import {
  printSuiteOutputs,
  printSuitePostProcessFeedback,
  printSuiteSummary,
} from "./display.ts";
import { executeSuiteSteps } from "./execution.ts";
import { prepareSuiteReport } from "./report.ts";
import { selectSuiteSteps } from "./selection.ts";

/** Runs the configured quality suite with optional step filtering and summary mode. */
export async function runCheckSuite(
  keyFilter?: null | Set<string>,
  options: {
    excludedKeys?: ReadonlySet<string>;
    indicator?: CheckingIndicatorController;
    summaryOnly?: boolean;
  } = {},
): Promise<void> {
  const startedAtMs = Date.now();
  const deadlineMs = startedAtMs + SUITE_TIMEOUT_MS;
  const summaryOnly = options.summaryOnly === true;
  const loadSuiteReport = async () => {
    const excludedKeys = options.excludedKeys ?? new Set<string>();
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
    return { executionState, report };
  };
  const { executionState, report } =
    options.indicator === undefined
      ? await withCheckingIndicator(loadSuiteReport, {
          enabled: !summaryOnly,
        })
      : await runSuiteWithIndicator(options.indicator, loadSuiteReport);

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

async function runSuiteWithIndicator<T>(
  indicator: CheckingIndicatorController,
  task: () => Promise<T>,
): Promise<T> {
  try {
    await waitForIndicatorPaint();
    return await task();
  } finally {
    await indicator.stop();
  }
}
