import type { ArchitectureViolation } from "./types.ts";

import {
  discoverArchitectureProject,
  normalizeArchitectureConfig,
} from "./discovery.ts";
import { analyzeImportRules } from "./import-rules.ts";
import { analyzeStructureRules } from "./structure-rules.ts";

/** Analyzes a repository and returns architecture violations derived from its layout. */
export function analyzeArchitecture(
  cwd: string,
  configValue: unknown,
): ArchitectureViolation[] {
  const project = discoverArchitectureProject(
    cwd,
    normalizeArchitectureConfig(configValue),
  );

  return dedupeViolations([
    ...analyzeImportRules(project),
    ...analyzeStructureRules(project),
  ]).sort((left, right) => left.message.localeCompare(right.message));
}

/** Formats architecture violations for a check-suite step output. */
export function formatArchitectureViolations(
  violations: ArchitectureViolation[],
): string {
  if (violations.length === 0) {
    return "architecture: 0 violations\n";
  }

  return [
    `architecture: ${violations.length} violations`,
    ...violations.map(
      (violation) => `  - [${violation.code}] ${violation.message}`,
    ),
    "",
  ].join("\n");
}

function dedupeViolations(
  violations: ArchitectureViolation[],
): ArchitectureViolation[] {
  const seen = new Set<string>();

  return violations.filter((violation) => {
    const key = `${violation.code}:${violation.message}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
