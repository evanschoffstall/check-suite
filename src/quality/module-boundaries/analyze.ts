import type { ArchitectureViolation } from "@/quality/module-boundaries/foundation/index.ts";

import { dedupeArchitectureViolations } from "@/quality/module-boundaries/analysis/index.ts";
import {
  discoverArchitectureProject,
  normalizeArchitectureConfig,
} from "@/quality/module-boundaries/discovery/index.ts";
import { analyzeImportRules } from "@/quality/module-boundaries/import/index.ts";
import { analyzeStructureRules } from "@/quality/module-boundaries/structure/index.ts";

export { formatArchitectureViolations } from "@/quality/module-boundaries/report/index.ts";

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
  return dedupeArchitectureViolations(violations);
}
