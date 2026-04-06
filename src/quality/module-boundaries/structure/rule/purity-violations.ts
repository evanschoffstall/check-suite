import type {
  ArchitectureDependencyPolicy,
  ArchitectureProject,
  ArchitectureViolation,
  SourceFileFacts,
} from "@/quality/module-boundaries/foundation/index.ts";

import { entrypointAllowsTopLevelStatements } from "@/quality/module-boundaries/foundation/index.ts";
import { inferDependencyPolicy } from "@/quality/module-boundaries/import/rule/index.ts";

/** Flags public surfaces that contain implementation rather than a pure export surface. */
export function buildPublicSurfacePurityViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return getTargetFacts(project).flatMap((sourceFact) =>
    sourceFact.topLevelExecutableStatementCount > 0 &&
    !project.config.allowedImpurePublicSurfacePaths.includes(sourceFact.path) &&
    !entrypointAllowsTopLevelStatements(project.config, sourceFact.stem)
      ? [
          {
            code: "public-surface-purity",
            message: `${sourceFact.path} contains top-level implementation statements; keep public surfaces as pure import/export facades or explicitly allow them`,
          },
        ]
      : [],
  );
}

/** Flags runtime-only top-level operations outside declared runtime modules. */
export function buildRuntimeOnlyPathViolations(
  project: ArchitectureProject,
): ArchitectureViolation[] {
  return project.sourceFacts.flatMap((sourceFact) =>
    sourceFact.runtimeOperationCount > 0 &&
    !isRuntimeOnlyPolicyPath(project, sourceFact.path)
      ? [
          {
            code: "runtime-only-path",
            message: `${sourceFact.path} performs ${sourceFact.runtimeOperationCount} top-level runtime operation(s); restrict runtime initialization to declared runtime modules`,
          },
        ]
      : [],
  );
}

function getTargetFacts(project: ArchitectureProject): SourceFileFacts[] {
  return project.sourceFacts.filter(
    (sourceFact) =>
      isPublicSurfaceFact(project, sourceFact) ||
      project.config.explicitPublicSurfacePaths.includes(sourceFact.path),
  );
}

function isPrivateRuntimePolicy(
  policy: ArchitectureDependencyPolicy | null,
): boolean {
  return policy?.surfaceTier === "private-runtime";
}

function isPublicSurfaceFact(
  project: ArchitectureProject,
  sourceFact: SourceFileFacts,
): boolean {
  if (!sourceFact.isEntrypoint) {
    return false;
  }

  return !isPrivateRuntimePolicy(
    inferDependencyPolicy(sourceFact.path, project.config.dependencyPolicies),
  );
}

function isRuntimeOnlyPolicyPath(
  project: ArchitectureProject,
  filePath: string,
): boolean {
  return (
    inferDependencyPolicy(filePath, project.config.dependencyPolicies)
      ?.surfaceTier === "private-runtime"
  );
}
