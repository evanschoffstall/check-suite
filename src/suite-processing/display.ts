import type { CheckRow, ProcessedResultEntry } from "@/types/index.ts";

import type { Command, StepConfig } from "../types/index.ts";

import {
  ANSI,
  divider,
  paint,
  printPostProcessMessages,
  printPostProcessSections,
  printStepOutput,
  row,
} from "../format.ts";

/** Prints each executed step's display output to stdout. */
export function printSuiteOutputs(
  allExecutedSteps: StepConfig[],
  runs: Record<string, Command>,
  processedResults: Record<string, ProcessedResultEntry>,
  suiteExpiredBeforeOutput: boolean,
  summaryOnly: boolean,
): void {
  if (summaryOnly || suiteExpiredBeforeOutput) return;

  for (const step of allExecutedSteps) {
    if (runs[step.key].notFound) continue;
    const postProcessedOutput = processedResults[step.key].postProcess?.output;
    printStepOutput(
      step.label,
      postProcessedOutput ?? processedResults[step.key].displayOutput,
    );
  }
}

/** Prints post-process feedback messages and sections for each executed main step. */
export function printSuitePostProcessFeedback(
  executedMainSteps: StepConfig[],
  processedResults: Record<string, ProcessedResultEntry>,
  suiteExpiredBeforeOutput: boolean,
  summaryOnly: boolean,
  missingSteps: string[],
): void {
  if (summaryOnly) return;
  if (suiteExpiredBeforeOutput) {
    console.info(
      `\n${paint("Suite deadline reached before detailed output; skipping step output and post-processing.", ANSI.bold, ANSI.yellow)}`,
    );
  }

  for (const step of executedMainSteps) {
    if (suiteExpiredBeforeOutput) break;
    const processed = processedResults[step.key].postProcess;
    if (processed?.messages?.length) {
      printPostProcessMessages(processed.messages);
    }
    if (processed?.sections?.length) {
      printPostProcessSections(processed.sections);
    }
  }

  if (missingSteps.length > 0) {
    console.info(
      `\n${paint("missing/not found:", ANSI.bold, ANSI.yellow)} ${paint(missingSteps.join(", "), ANSI.yellow)}`,
    );
  }
}

/** Prints the quality summary table and returns `true` when all checks passed. */
export function printSuiteSummary(
  checks: CheckRow[],
  runs: Record<string, Command>,
  startedAtMs: number,
): boolean {
  const presentChecks = checks.filter(
    (check) => !check.stepKey || !runs[check.stepKey].notFound,
  );
  console.info(`\n${paint("Quality Summary", ANSI.bold, ANSI.cyan)}`);
  console.info(divider());
  for (const check of presentChecks) {
    console.info(
      row(check.label, check.status, check.details, check.durationMs),
    );
  }
  console.info(divider());

  const allOk = presentChecks.every((check) => check.status !== "fail");
  const elapsedSeconds = ((Date.now() - startedAtMs) / 1000).toFixed(2);
  console.info(
    row(
      "Overall",
      allOk ? "pass" : "fail",
      `${allOk ? "all checks passed" : "one or more checks failed"} (in ${elapsedSeconds} seconds)`,
    ),
  );
  console.info(divider());
  return allOk;
}

/** Writes the suite progress indicator unless running in summary-only mode. */
export function startSuiteProgress(summaryOnly: boolean): void {
  if (summaryOnly) return;
  process.stdout.write(paint("⏳ Please wait ... ", ANSI.bold, ANSI.cyan));
}
