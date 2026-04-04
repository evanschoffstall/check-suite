import type {
  ArchitectureProject,
  ArchitectureViolation,
} from "../foundation/index.ts";

import { dedupeArchitectureViolations } from "../analysis/index.ts";
import {
  buildImportEntryViolations,
  collectInternalImports,
  collectSiblingImports,
} from "./rule/index.ts";

export { collectImports } from "./collection.ts";

/** Applies import-surface architecture rules to the discovered project graph. */
export function analyzeImportRules(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = [];
  const repeatedDeepImports = new Map<string, Set<string>>();

  for (const entry of project.imports) {
    violations.push(
      ...buildImportEntryViolations(project, entry, repeatedDeepImports),
    );
  }

  violations.push(
    ...buildRepeatedDeepImportViolations(project, repeatedDeepImports),
  );
  violations.push(...buildSiblingImportViolations(project));
  violations.push(...buildInternalImportViolations(project));

  return dedupeArchitectureViolations(violations);
}

function buildInternalImportViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return [...collectInternalImports(project).entries()].flatMap(
    ([sourcePath, imports]) =>
      imports.size > project.config.maxInternalImportsPerFile
        ? [
            {
              code: "too-many-internal-dependencies",
              message: `${sourcePath} imports ${imports.size} internal modules; split responsibilities or move shared code behind a smaller public seam`,
            },
          ]
        : [],
  );
}

function buildRepeatedDeepImportViolations(
  project: ArchitectureProject,
  repeatedDeepImports: Map<string, Set<string>>,
): ArchitectureViolation[] {
  return [...repeatedDeepImports.entries()].flatMap(([targetPath, sources]) =>
    sources.size < project.config.minRepeatedDeepImports
      ? []
      : [
          {
            code: "repeated-deep-import",
            message: `${targetPath} is imported directly from ${sources.size} files; expose a stable public surface instead of repeating internal imports`,
          },
        ],
  );
}

function buildSiblingImportViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return [...collectSiblingImports(project).entries()].flatMap(
    ([sourcePath, siblingImports]) =>
      siblingImports.size > project.config.maxSiblingImports
        ? [
            {
              code: "sibling-import-cohesion",
              message: `${sourcePath} imports ${siblingImports.size} sibling modules; extract a smaller owner or move shared code to the actual boundary`,
            },
          ]
        : [],
  );
}
