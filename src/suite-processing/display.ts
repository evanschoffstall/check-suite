import type {
  CheckRow,
  Command,
  ProcessedResultEntry,
  StepConfig,
  SuiteOutputMode,
  SuiteRenderMode,
} from "@/types/index.ts";

import {
  ANSI,
  divider,
  paint,
  printPostProcessMessages,
  printPostProcessSections,
  printStepOutput,
  row,
} from "@/format/index.ts";

interface SuiteDetailDisplayOptions {
  failureOutputLineLimit: null | number;
  outputMode: SuiteOutputMode;
  renderMode: SuiteRenderMode;
  runs: Record<string, Command>;
}

/** Prints each executed step's display output to stdout. */
export function printSuiteOutputs(
  allExecutedSteps: StepConfig[],
  detailOptions: SuiteDetailDisplayOptions,
  processedResults: Record<string, ProcessedResultEntry>,
  suiteExpiredBeforeOutput: boolean,
  summaryOnly: boolean,
): void {
  if (summaryOnly || suiteExpiredBeforeOutput) return;

  for (const step of allExecutedSteps) {
    if (detailOptions.runs[step.key].notFound) continue;
    const status = getStepStatus(step.key, detailOptions.runs, processedResults);
    if (!shouldPrintStepDetails(status, detailOptions.outputMode)) {
      continue;
    }
    const postProcessedOutput = processedResults[step.key].postProcess?.output;
    printStepOutput(
      step.label,
      limitFailingOutputLines(
        postProcessedOutput ?? processedResults[step.key].displayOutput,
        detailOptions.failureOutputLineLimit,
        status,
      ),
      detailOptions.renderMode,
    );
  }
}

/** Prints post-process feedback messages and sections for each executed main step. */
export function printSuitePostProcessFeedback(
  executedMainSteps: StepConfig[],
  processedResults: Record<string, ProcessedResultEntry>,
  detailOptions: SuiteDetailDisplayOptions,
  suiteExpiredBeforeOutput: boolean,
  summaryOnly: boolean,
  missingSteps: string[],
): void {
  if (summaryOnly) return;
  if (suiteExpiredBeforeOutput) {
    console.info(
      `\n${formatNotice(
        "Suite deadline reached before detailed output; skipping step output and post-processing.",
        ANSI.yellow,
        detailOptions.renderMode,
      )}`,
    );
  }

  for (const step of executedMainSteps) {
    if (suiteExpiredBeforeOutput) break;
    if (
      !shouldPrintStepDetails(
        getStepStatus(step.key, detailOptions.runs, processedResults),
        detailOptions.outputMode,
      )
    ) {
      continue;
    }
    const processed = processedResults[step.key].postProcess;
    if (processed?.messages?.length) {
      printPostProcessMessages(processed.messages, detailOptions.renderMode);
    }
    if (processed?.sections?.length) {
      printPostProcessSections(processed.sections, detailOptions.renderMode);
    }
  }

  if (missingSteps.length > 0) {
    const missingLabel = formatNotice(
      "missing/not found:",
      ANSI.yellow,
      detailOptions.renderMode,
    );
    const missingValue =
      detailOptions.renderMode === "plain"
        ? missingSteps.join(", ")
        : paint(missingSteps.join(", "), ANSI.yellow);
    console.info(`\n${missingLabel} ${missingValue}`);
  }
}

/** Prints the quality summary table and returns `true` when all checks passed. */
export function printSuiteSummary(
  checks: CheckRow[],
  runs: Record<string, Command>,
  startedAtMs: number,
  renderMode: SuiteRenderMode,
): boolean {
  const presentChecks = checks.filter(
    (check) => !check.stepKey || !runs[check.stepKey].notFound,
  );
  console.info(`\n${formatNotice("Quality Summary", ANSI.cyan, renderMode)}`);
  console.info(divider(renderMode));
  for (const check of presentChecks) {
    console.info(
      row(check.label, check.status, check.details, check.durationMs, renderMode),
    );
  }
  console.info(divider(renderMode));

  const allOk = presentChecks.every((check) => check.status !== "fail");
  const elapsedSeconds = ((Date.now() - startedAtMs) / 1000).toFixed(2);
  console.info(
    row(
      "Overall",
      allOk ? "pass" : "fail",
      `${allOk ? "all checks passed" : "one or more checks failed"} (in ${elapsedSeconds} seconds)`,
      undefined,
      renderMode,
    ),
  );
  console.info(divider(renderMode));
  return allOk;
}

function formatNotice(
  text: string,
  color: string,
  renderMode: SuiteRenderMode,
): string {
  return renderMode === "plain" ? text : paint(text, ANSI.bold, color);
}

function getStepStatus(
  stepKey: string,
  runs: Record<string, Command>,
  processedResults: Record<string, ProcessedResultEntry>,
): "fail" | "pass" {
  return (
    processedResults[stepKey].postProcess?.status ??
    (runs[stepKey].exitCode === 0 ? "pass" : "fail")
  );
}

/** Truncates detailed failing output to the configured line budget, when set. */
function limitFailingOutputLines(
  output: string,
  failureOutputLineLimit: null | number,
  status: "fail" | "pass",
): string {
  if (status === "pass" || failureOutputLineLimit === null) {
    return output;
  }

  const normalizedOutput = output.replace(/\r\n/gu, "\n");
  const visibleLines = normalizedOutput.endsWith("\n")
    ? normalizedOutput.slice(0, -1).split("\n")
    : normalizedOutput.split("\n");
  if (visibleLines.length <= failureOutputLineLimit) {
    return output;
  }

  const truncatedLabel =
    failureOutputLineLimit === 1 ? "line" : "lines";
  return `${visibleLines.slice(0, failureOutputLineLimit).join("\n")}\n... truncated to first ${failureOutputLineLimit} ${truncatedLabel} of failing output (--fail-lines=${failureOutputLineLimit})`;
}

function shouldPrintStepDetails(
  status: "fail" | "pass",
  outputMode: SuiteOutputMode,
): boolean {
  if (outputMode === "all") {
    return true;
  }

  return status === "fail";
}

