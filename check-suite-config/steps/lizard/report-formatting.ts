import type { ComplexityThresholds, ComplexityViolation } from "./contracts.ts";

const MAX_REPORTED_VIOLATIONS = 50;

export function formatThresholdSummary(
  thresholds: ComplexityThresholds,
): string {
  return [
    `function CCN<=${thresholds.functionCcn}`,
    `function length<=${thresholds.functionLength}`,
    `function nesting<=${thresholds.functionNestingDepth}`,
    `function NLOC<=${thresholds.functionNloc}`,
    `function tokens<=${thresholds.functionTokenCount}`,
    `function params<=${thresholds.functionParameterCount}`,
    `file CCN<=${thresholds.fileCcn}`,
    `file functions<=${thresholds.fileFunctionCount}`,
    `file NLOC<=${thresholds.fileNloc}`,
    `file tokens<=${thresholds.fileTokenCount}`,
  ].join(" · ");
}

export function formatViolations(
  title: string,
  violations: ComplexityViolation[],
): string[] {
  const lines = [title];

  for (const violation of violations.slice(0, MAX_REPORTED_VIOLATIONS)) {
    lines.push(`  - ${violation.target}: ${violation.metrics.join(", ")}`);
  }

  if (violations.length > MAX_REPORTED_VIOLATIONS) {
    lines.push(
      `  - ... ${violations.length - MAX_REPORTED_VIOLATIONS} more violation(s) omitted`,
    );
  }

  return lines;
}
