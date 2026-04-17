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
  buildSummaryRowLayout,
  divider,
  paint,
  printPostProcessMessages,
  printPostProcessSections,
  printStepOutput,
  row,
  summaryHeaderRow,
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
    const status = getStepStatus(
      step.key,
      detailOptions.runs,
      processedResults,
    );
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
  missingSteps: string[],
  runs: Record<string, Command>,
  startedAtMs: number,
  renderMode: SuiteRenderMode,
): boolean {
  const presentChecks = checks.filter(
    (check) => !check.stepKey || !runs[check.stepKey].notFound,
  );
  const elapsedSeconds = ((Date.now() - startedAtMs) / 1000).toFixed(2);
  const passCount = presentChecks.filter(
    (check) => check.status === "pass",
  ).length;
  const failCount = presentChecks.length - passCount;
  const summaryLayout = buildSummaryRowLayout([
    ...presentChecks,
    {
      details: allChecksSummaryDetails(failCount, elapsedSeconds),
      label: "Overall",
    },
  ]);

  console.info(`\n${formatNotice("Quality Summary", ANSI.cyan, renderMode)}`);
  console.info(
    formatSummaryMeta(
      passCount,
      failCount,
      missingSteps.length,
      elapsedSeconds,
      renderMode,
    ),
  );
  console.info(divider(renderMode, summaryLayout.totalWidth));
  console.info(summaryHeaderRow(summaryLayout, renderMode));
  console.info(divider(renderMode, summaryLayout.totalWidth));
  for (const check of presentChecks) {
    console.info(
      row({
        details: resolveSummaryDetails(check.details, check.status),
        durationMs: check.durationMs,
        label: check.label,
        layout: summaryLayout,
        renderMode,
        status: check.status,
      }),
    );
  }
  console.info(divider(renderMode, summaryLayout.totalWidth));

  const allOk = presentChecks.every((check) => check.status !== "fail");
  console.info(
    row({
      details: allChecksSummaryDetails(failCount, elapsedSeconds),
      label: "Overall",
      layout: summaryLayout,
      renderMode,
      status: allOk ? "pass" : "fail",
    }),
  );
  console.info(divider(renderMode, summaryLayout.totalWidth));
  return allOk;
}

function allChecksSummaryDetails(
  failCount: number,
  elapsedSeconds: string,
): string {
  return `${failCount === 0 ? "all checks passed" : "one or more checks failed"} in ${elapsedSeconds}s`;
}

function formatNotice(
  text: string,
  color: string,
  renderMode: SuiteRenderMode,
): string {
  return renderMode === "plain" ? text : paint(text, ANSI.bold, color);
}

function formatSummaryMeta(
  passCount: number,
  failCount: number,
  missingCount: number,
  elapsedSeconds: string,
  renderMode: SuiteRenderMode,
): string {
  const parts = [
    renderMode === "plain"
      ? `${passCount} passed`
      : paint(`${passCount} passed`, ANSI.green),
    renderMode === "plain"
      ? `${failCount} failed`
      : paint(`${failCount} failed`, failCount > 0 ? ANSI.red : ANSI.gray),
  ];

  if (missingCount > 0) {
    parts.push(
      renderMode === "plain"
        ? `${missingCount} missing`
        : paint(`${missingCount} missing`, ANSI.yellow),
    );
  }

  parts.push(
    renderMode === "plain"
      ? `${elapsedSeconds}s total`
      : paint(`${elapsedSeconds}s total`, ANSI.gray),
  );

  return parts.join(
    renderMode === "plain" ? " | " : ` ${paint("•", ANSI.gray)} `,
  );
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

  const truncatedLabel = failureOutputLineLimit === 1 ? "line" : "lines";
  return `${visibleLines.slice(0, failureOutputLineLimit).join("\n")}\n... truncated to first ${failureOutputLineLimit} ${truncatedLabel} of failing output (--fail-lines=${failureOutputLineLimit})`;
}

function resolveSummaryDetails(
  details: string,
  status: "fail" | "pass",
): string {
  if (details.trim().length > 0) {
    return details;
  }

  return status === "pass" ? "completed" : "failed";
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
