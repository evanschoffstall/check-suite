import { ANSI, divider, paint } from "@/format.ts";

import type {
  ComplexityThresholds,
  ComplexityViolation,
  FileMetrics,
  TypeScriptFunctionMetrics,
} from "./contracts.ts";

type FunctionMetrics = TypeScriptFunctionMetrics;

const MAX_REPORTED_VIOLATIONS = 50;
const METRIC_DETAIL_PATTERN =
  /^(?<label>.+?)\s+(?<actual>\d+)\s+>\s+(?<limit>\d+)$/u;

// ---------------------------------------------------------------------------
// Threshold summary formatting
// ---------------------------------------------------------------------------

export function buildLizardReportWithFiles(
  functions: FunctionMetrics[],
  files: FileMetrics[],
  thresholds: ComplexityThresholds,
): {
  exitCode: 0 | 1;
  output: string;
} {
  if (functions.length === 0 && files.length === 0) {
    return {
      exitCode: 1,
      output: [
        "complexity: 0 function violations · 0 file violations",
        paint("No lizard rows were produced.", ANSI.bold, ANSI.yellow),
      ].join("\n"),
    };
  }

  const functionViolations = findFunctionViolations(functions, thresholds);
  const fileViolations = findFileViolations(files, thresholds);
  const summary = buildSummary(
    functionViolations.length,
    fileViolations.length,
  );
  const thresholdBlock = formatThresholdBlock(thresholds);

  if (functionViolations.length === 0 && fileViolations.length === 0) {
    return {
      exitCode: 0,
      output: [summary, thresholdBlock].join("\n"),
    };
  }

  return {
    exitCode: 1,
    output: [
      summary,
      thresholdBlock,
      ...buildViolationSections(functionViolations, fileViolations),
    ].join("\n"),
  };
}

export function findFileViolations(
  files: FileMetrics[],
  thresholds: ComplexityThresholds,
): ComplexityViolation[] {
  return files.flatMap((entry) => {
    const exceededMetrics = [
      entry.ccn > thresholds.fileCcn
        ? `file CCN ${entry.ccn} > ${thresholds.fileCcn}`
        : null,
      entry.functionCount > thresholds.fileFunctionCount
        ? `file functions ${entry.functionCount} > ${thresholds.fileFunctionCount}`
        : null,
      entry.nloc > thresholds.fileNloc
        ? `file NLOC ${entry.nloc} > ${thresholds.fileNloc}`
        : null,
      entry.tokenCount > thresholds.fileTokenCount
        ? `file tokens ${entry.tokenCount} > ${thresholds.fileTokenCount}`
        : null,
    ].filter((metric): metric is string => metric !== null);

    return exceededMetrics.length === 0
      ? []
      : [{ metrics: exceededMetrics, target: entry.path }];
  });
}

// ---------------------------------------------------------------------------
// Violation detection
// ---------------------------------------------------------------------------

export function findFunctionViolations(
  functions: FunctionMetrics[],
  thresholds: ComplexityThresholds,
): ComplexityViolation[] {
  return functions.flatMap((entry) => {
    const exceededMetrics = [
      entry.ccn > thresholds.functionCcn
        ? `CCN ${entry.ccn} > ${thresholds.functionCcn}`
        : null,
      entry.length > thresholds.functionLength
        ? `length ${entry.length} > ${thresholds.functionLength}`
        : null,
      entry.nestingDepth > thresholds.functionNestingDepth
        ? `nesting ${entry.nestingDepth} > ${thresholds.functionNestingDepth}`
        : null,
      entry.nloc > thresholds.functionNloc
        ? `NLOC ${entry.nloc} > ${thresholds.functionNloc}`
        : null,
      entry.tokenCount > thresholds.functionTokenCount
        ? `tokens ${entry.tokenCount} > ${thresholds.functionTokenCount}`
        : null,
      entry.parameterCount > thresholds.functionParameterCount
        ? `params ${entry.parameterCount} > ${thresholds.functionParameterCount}`
        : null,
    ].filter((metric): metric is string => metric !== null);

    return exceededMetrics.length === 0
      ? []
      : [
          {
            metrics: exceededMetrics,
            target: `${entry.functionName} (${entry.location})`,
          },
        ];
  });
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

function buildSummary(
  functionViolationCount: number,
  fileViolationCount: number,
): string {
  return `complexity: ${functionViolationCount} function violations · ${fileViolationCount} file violations`;
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

function buildViolationSections(
  functionViolations: ReturnType<typeof findFunctionViolations>,
  fileViolations: ReturnType<typeof findFileViolations>,
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

/** Formats the omitted-violations footer when the report is truncated. */
function formatOverflowLine(overflowCount: number): string {
  return `  ${paint("...", ANSI.gray)} ${paint(`${overflowCount} more violation(s) omitted`, ANSI.gray)}`;
}

/** Formats a colored section heading with the number of violations in that group. */
function formatSectionHeading(title: string, count: number): string {
  const normalizedTitle = title.replace(/:\s*$/u, "");
  return paint(`${normalizedTitle} (${count})`, ANSI.bold, ANSI.red);
}

/** Renders threshold limits as a compact block split by function and file scope. */
function formatThresholdBlock(thresholds: ComplexityThresholds): string {
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

/** Formats a single threshold row with a fixed-width label for easier scanning. */
function formatThresholdRow(label: string, metrics: string[]): string {
  return [
    `  ${paint(label.padEnd(10), ANSI.bold)}`,
    paint(metrics.join("  |  "), ANSI.gray),
  ].join(" ");
}

/** Formats aligned metric details underneath a violation target. */
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

/** Formats the numbered target line for a single violating file or function. */
function formatViolationTargetLine(index: number, target: string): string {
  return `  ${paint(`[${index}]`, ANSI.bold, ANSI.red)} ${paint(target, ANSI.bold)}`;
}

/** Removes section-level prefixes so metric labels stay compact inside a section. */
function normalizeMetricLabel(label: string, title: string): string {
  const trimmedLabel = label.trim();

  if (!title.startsWith("File ")) {
    return trimmedLabel;
  }

  return trimmedLabel.replace(/^file\s+/u, "");
}

/** Parses a metric detail string into aligned fields for the report body. */
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
