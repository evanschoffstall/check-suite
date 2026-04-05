import type {
  ComplexityThresholds,
  ComplexityViolation,
} from "@/steps/lizard/shared/index.ts";

import { ANSI, divider, paint } from "@/format/index.ts";

const MAX_REPORTED_VIOLATIONS = 50;
const METRIC_DETAIL_PATTERN =
  /^(?<label>.+?)\s+(?<actual>\d+)\s+>\s+(?<limit>\d+)$/u;

export function buildViolationSections(
  functionViolations: ComplexityViolation[],
  fileViolations: ComplexityViolation[],
): string[] {
  const outputLines: string[] = [];

  if (functionViolations.length > 0) {
    outputLines.push(
      ...formatViolations("Function threshold violations:", functionViolations),
    );
  }

  if (fileViolations.length > 0) {
    outputLines.push(
      ...formatViolations("File threshold violations:", fileViolations),
    );
  }

  return outputLines;
}

/** Renders threshold limits as a compact block split by function and file scope. */
export function formatThresholdBlock(thresholds: ComplexityThresholds): string {
  return [
    divider(),
    paint("Thresholds", ANSI.bold, ANSI.cyan),
    formatThresholdRow("Functions", [
      `CCN<=${thresholds.functionCcn}`,
      `length<=${thresholds.functionLength}`,
      `nesting<=${thresholds.functionNestingDepth}`,
      `NLOC<=${thresholds.functionNloc}`,
      `tokens<=${thresholds.functionTokenCount}`,
      `params<=${thresholds.functionParameterCount}`,
    ]),
    formatThresholdRow("Files", [
      `CCN<=${thresholds.fileCcn}`,
      `functions<=${thresholds.fileFunctionCount}`,
      `NLOC<=${thresholds.fileNloc}`,
      `tokens<=${thresholds.fileTokenCount}`,
    ]),
    divider(),
  ].join("\n");
}

/** Formats a list of complexity violations into labelled output lines. */
export function formatViolations(
  title: string,
  violations: ComplexityViolation[],
): string[] {
  const lines = [formatSectionHeading(title, violations.length)];

  for (const [index, violation] of violations
    .slice(0, MAX_REPORTED_VIOLATIONS)
    .entries()) {
    lines.push(formatViolationTargetLine(index + 1, violation.target));
    lines.push(...formatViolationMetricLines(title, violation.metrics));
  }

  if (violations.length > MAX_REPORTED_VIOLATIONS) {
    lines.push(formatOverflowLine(violations.length - MAX_REPORTED_VIOLATIONS));
  }

  return lines;
}

function formatOverflowLine(overflowCount: number): string {
  return `  ${paint("...", ANSI.gray)} ${paint(`${overflowCount} more violation(s) omitted`, ANSI.gray)}`;
}

function formatSectionHeading(title: string, count: number): string {
  const normalizedTitle = title.replace(/:\s*$/u, "");
  return paint(`${normalizedTitle} (${count})`, ANSI.bold, ANSI.red);
}

function formatThresholdRow(label: string, metrics: string[]): string {
  return [
    `  ${paint(label.padEnd(10), ANSI.bold)}`,
    paint(metrics.join("  |  "), ANSI.gray),
  ].join(" ");
}

function formatViolationMetricLines(
  title: string,
  metrics: string[],
): string[] {
  return metrics.map((metric) => {
    const parsedMetric = parseMetricDetail(metric, title);
    if (parsedMetric === null) {
      return `      ${paint(metric, ANSI.yellow)}`;
    }

    const overLimitBy = parsedMetric.actual - parsedMetric.limit;
    return [
      `      ${paint(parsedMetric.label.padEnd(12), ANSI.yellow)}`,
      paint(String(parsedMetric.actual).padStart(5), ANSI.bold, ANSI.red),
      paint(">", ANSI.gray),
      paint(String(parsedMetric.limit).padEnd(5), ANSI.gray),
      paint(`(+${overLimitBy})`, ANSI.bold, ANSI.red),
    ].join(" ");
  });
}

function formatViolationTargetLine(index: number, target: string): string {
  return `  ${paint(`[${index}]`, ANSI.bold, ANSI.red)} ${paint(target, ANSI.bold)}`;
}

function normalizeMetricLabel(label: string, title: string): string {
  const trimmedLabel = label.trim();
  if (!title.startsWith("File ")) {
    return trimmedLabel;
  }

  return trimmedLabel.replace(/^file\s+/u, "");
}

function parseMetricDetail(
  metric: string,
  title: string,
): null | { actual: number; label: string; limit: number } {
  const match = METRIC_DETAIL_PATTERN.exec(metric);
  if (match?.groups === undefined) {
    return null;
  }

  const actual = Number(match.groups.actual);
  const limit = Number(match.groups.limit);
  if (!Number.isFinite(actual) || !Number.isFinite(limit)) {
    return null;
  }

  return {
    actual,
    label: normalizeMetricLabel(match.groups.label, title),
    limit,
  };
}
