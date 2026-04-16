import type { ArchitectureViolation } from "@/quality/module-boundaries/foundation/index.ts";

import { ANSI, divider, paint } from "@/format/index.ts";

/** Maximum violations to render per rule-code group before truncating. */
const MAX_VIOLATIONS_PER_GROUP = 50;

/**
 * Formats architecture violations into a styled, human-readable report
 * grouped by rule code, matching the generic complexity report style.
 */
export function formatArchitectureViolations(
  violations: ArchitectureViolation[],
): string {
  if (violations.length === 0) {
    return "architecture: 0 violations\n";
  }

  const grouped = groupByCode(violations);
  const lines: string[] = [
    `architecture: ${violations.length} violation${violations.length === 1 ? "" : "s"}`,
  ];

  for (const [code, groupViolations] of grouped) {
    lines.push(divider());
    lines.push(formatGroupHeading(code, groupViolations.length));
    lines.push(...formatGroupViolationLines(groupViolations));
  }

  lines.push("");
  return lines.join("\n");
}

/** Renders the section heading for a single rule-code group. */
function formatGroupHeading(code: string, count: number): string {
  return paint(`${code} (${count})`, ANSI.bold, ANSI.red);
}

/** Renders numbered violation lines for one group, truncating if over the limit. */
function formatGroupViolationLines(
  violations: ArchitectureViolation[],
): string[] {
  const lines: string[] = [];

  for (const [index, violation] of violations
    .slice(0, MAX_VIOLATIONS_PER_GROUP)
    .entries()) {
    lines.push(
      `  ${paint(`[${index + 1}]`, ANSI.bold, ANSI.red)} ${violation.message}`,
    );
  }

  if (violations.length > MAX_VIOLATIONS_PER_GROUP) {
    const overflow = violations.length - MAX_VIOLATIONS_PER_GROUP;
    lines.push(
      `  ${paint("...", ANSI.gray)} ${paint(`${overflow} more violation(s) omitted`, ANSI.gray)}`,
    );
  }

  return lines;
}

/** Groups violations by rule code, preserving insertion order. */
function groupByCode(
  violations: ArchitectureViolation[],
): Map<string, ArchitectureViolation[]> {
  const groups = new Map<string, ArchitectureViolation[]>();

  for (const violation of violations) {
    const existing = groups.get(violation.code);
    if (existing !== undefined) {
      existing.push(violation);
    } else {
      groups.set(violation.code, [violation]);
    }
  }

  return groups;
}
