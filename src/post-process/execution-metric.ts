import type {
  InlineTypeScriptConfig,
  InlineTypeScriptPostProcessContext,
  PostProcessMessage,
  PostProcessSection,
  ProcessedCheck,
  StepPostProcessResult,
} from "@/types/index.ts";

import {
  appendThresholdMetricCheck,
  type ThresholdMetricTotals,
} from "./metric-threshold.ts";
import {
  buildExecutionReportSummary,
  parseTestSuitesXmlReport,
  type TestSuitesExecutionReport,
} from "./test-suites.ts";

export interface ExecutionMetricPostProcessOptions {
  metricLabel: string;
  metricPath: string;
  reportPath: string;
  resolveMetric: MetricResolver;
  threshold: number;
}

export type MetricResolver = (
  context: MetricResolverContext,
) => MetricResolverResult;

export interface MetricResolverContext {
  data: Record<string, unknown>;
  displayOutput: string;
  existsSync: InlineTypeScriptPostProcessContext["existsSync"];
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"];
  resolveTokenString: InlineTypeScriptPostProcessContext["resolveTokenString"];
}

export interface MetricResolverResult {
  messages?: PostProcessMessage[];
  totals: null | ThresholdMetricTotals;
}

/**
 * Builds a generic post-process that combines a testsuites-style execution
 * report with any caller-supplied thresholded metric.
 */
export function createExecutionMetricPostProcess(
  options: ExecutionMetricPostProcessOptions,
): InlineTypeScriptConfig<
  InlineTypeScriptPostProcessContext,
  StepPostProcessResult
> {
  return {
    data: {
      metricLabel: options.metricLabel,
      metricPath: options.metricPath,
      metricThreshold: options.threshold,
      reportPath: options.reportPath,
    },
    source: (context) => runExecutionMetricPostProcess(context, options),
  };
}

function appendExecutionSections(
  report: Pick<TestSuitesExecutionReport, "failedItems" | "skippedItems">,
  sections: PostProcessSection[],
): boolean {
  let hasFailures = false;

  if (report.failedItems.length > 0) {
    sections.push({
      items: report.failedItems,
      title: "Failed tests",
      tone: "fail",
    });
    hasFailures = true;
  }
  if (report.skippedItems.length > 0) {
    sections.push({
      items: report.skippedItems,
      title: "Skipped tests",
      tone: "warn",
    });
  }

  return hasFailures;
}

function appendMetricResult(
  context: InlineTypeScriptPostProcessContext,
  options: ExecutionMetricPostProcessOptions,
  resolved: { metricLabel: string; metricPath: string; threshold: number },
  messages: PostProcessMessage[],
  extraChecks: ProcessedCheck[],
): "fail" | "pass" {
  const metricResult = options.resolveMetric(context);
  if (metricResult.messages) messages.push(...metricResult.messages);
  return appendThresholdMetricCheck(
    metricResult.totals,
    resolved.metricLabel,
    resolved.metricPath,
    resolved.threshold,
    messages,
    extraChecks,
  )
    ? "fail"
    : "pass";
}

function resolveExecutionMetricData(
  context: InlineTypeScriptPostProcessContext,
  options: ExecutionMetricPostProcessOptions,
): {
  metricLabel: string;
  metricPath: string;
  reportPath: string;
  threshold: number;
} {
  const { data, resolveTokenString } = context;
  return {
    metricLabel:
      typeof data.metricLabel === "string"
        ? data.metricLabel
        : options.metricLabel,
    metricPath:
      typeof data.metricPath === "string"
        ? resolveTokenString(data.metricPath)
        : "",
    reportPath:
      typeof data.reportPath === "string"
        ? resolveTokenString(data.reportPath)
        : "",
    threshold:
      typeof data.metricThreshold === "number"
        ? data.metricThreshold
        : options.threshold,
  };
}

function resolveExecutionStatus(
  context: InlineTypeScriptPostProcessContext,
  report: TestSuitesExecutionReport,
  reportPath: string,
  messages: PostProcessMessage[],
  sections: PostProcessSection[],
): "fail" | "pass" {
  const initialStatus = context.command.exitCode === 0 ? "pass" : "fail";
  const reportExists = Boolean(reportPath) && context.existsSync(reportPath);
  if (reportExists) {
    return appendExecutionSections(report, sections) ? "fail" : initialStatus;
  }

  if (report.passed > 0 || report.failed > 0 || report.skipped > 0) {
    return report.failed > 0 ? "fail" : initialStatus;
  }

  messages.push({
    text: `Report file not found: ${reportPath || "(unset)"}`,
    tone: "fail",
  });
  return "fail";
}

function runExecutionMetricPostProcess(
  context: InlineTypeScriptPostProcessContext,
  options: ExecutionMetricPostProcessOptions,
): StepPostProcessResult {
  const resolved = resolveExecutionMetricData(context, options);
  const report = parseTestSuitesXmlReport(
    resolved.reportPath,
    context.displayOutput,
    context.existsSync,
    context.readFileSync,
  );
  const extraChecks: ProcessedCheck[] = [];
  const messages: PostProcessMessage[] = [];
  const sections: PostProcessSection[] = [];
  let status = resolveExecutionStatus(
    context,
    report,
    resolved.reportPath,
    messages,
    sections,
  );

  if (status === "pass") {
    status = appendMetricResult(
      context,
      options,
      resolved,
      messages,
      extraChecks,
    );
  }

  return {
    extraChecks,
    messages,
    output: context.helpers.compactDomAssertionNoise(context.displayOutput),
    sections,
    status,
    summary: buildExecutionReportSummary(report, context.command.exitCode),
  };
}
