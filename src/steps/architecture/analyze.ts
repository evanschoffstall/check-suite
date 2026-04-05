import type { ArchitectureViolation } from "@/steps/architecture/foundation/index.ts";

import { dedupeArchitectureViolations } from "@/steps/architecture/analysis/index.ts";
import {
  discoverArchitectureProject,
  normalizeArchitectureConfig,
} from "@/steps/architecture/discovery/index.ts";
import { analyzeImportRules } from "@/steps/architecture/import/index.ts";
import { analyzeStructureRules } from "@/steps/architecture/structure/index.ts";

export { formatArchitectureViolations } from "@/steps/architecture/report/index.ts";

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
