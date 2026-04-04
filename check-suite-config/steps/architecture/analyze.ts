import type { ArchitectureViolation } from "./foundation/index.ts";

import {
  discoverArchitectureProject,
  normalizeArchitectureConfig,
} from "./discovery/index.ts";
import { analyzeImportRules } from "./import/index.ts";
import { analyzeStructureRules } from "./structure/index.ts";

export { formatArchitectureViolations } from "./report/index.ts";

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
