import type {
  ArchitectureDependencyPolicy,
  ArchitectureProject,
  ArchitectureViolation,
  ImportRecord,
} from "@/quality/module-boundaries/foundation/index.ts";

import { inferDependencyPolicy } from "./dependency-policy-violations";

export function buildPolicyImportViolations(
  project: ArchitectureProject,
  entry: ImportRecord,
): ArchitectureViolation[] {
  const resolvedPath = entry.resolvedPath;
  if (!resolvedPath || project.config.dependencyPolicies.length === 0) {
    return [];
  }

  const sourcePolicy = inferDependencyPolicy(
    entry.sourcePath,
    project.config.dependencyPolicies,
  );
  const targetPolicy = inferDependencyPolicy(
    resolvedPath,
    project.config.dependencyPolicies,
  );

  if (!sourcePolicy || !targetPolicy) {
    return [];
  }

  return [
    ...buildDependencyDirectionViolations(
      entry.sourcePath,
      resolvedPath,
      sourcePolicy,
      targetPolicy,
    ),
    ...buildInboundDependencyViolations(
      entry.sourcePath,
      resolvedPath,
      sourcePolicy,
      targetPolicy,
    ),
    ...buildRuntimeImporterViolations(
      project,
      entry,
      resolvedPath,
      sourcePolicy,
      targetPolicy,
    ),
    ...buildTypeOnlyPolicyViolations(
      project,
      entry,
      resolvedPath,
      sourcePolicy,
      targetPolicy,
    ),
    ...buildSurfaceTierDependencyViolations(
      sourcePolicy,
      targetPolicy,
      entry.sourcePath,
      resolvedPath,
    ),
  ];
}

function buildDependencyDirectionViolations(
  sourcePath: string,
  resolvedPath: string,
  sourcePolicy: ArchitectureDependencyPolicy,
  targetPolicy: ArchitectureDependencyPolicy,
): ArchitectureViolation[] {
  if (
    sourcePolicy.name === targetPolicy.name ||
    sourcePolicy.mayDependOn.includes(targetPolicy.name)
  ) {
    return [];
  }

  return [
    {
      code: "dependency-policy",
      message: `${sourcePath} (${sourcePolicy.name}) depends on ${resolvedPath} (${targetPolicy.name}), which is outside its declared dependency policy`,
    },
  ];
}

function buildInboundDependencyViolations(
  sourcePath: string,
  resolvedPath: string,
  sourcePolicy: ArchitectureDependencyPolicy,
  targetPolicy: ArchitectureDependencyPolicy,
): ArchitectureViolation[] {
  if (
    targetPolicy.allowedDependents === undefined ||
    targetPolicy.allowedDependents.length === 0 ||
    sourcePolicy.name === targetPolicy.name ||
    targetPolicy.allowedDependents.includes(sourcePolicy.name)
  ) {
    return [];
  }

  return [
    {
      code: "dependency-dependent-allowlist",
      message: `${sourcePath} (${sourcePolicy.name}) depends on ${resolvedPath} (${targetPolicy.name}), but ${targetPolicy.name} only allows dependents from ${targetPolicy.allowedDependents.join(", ")}`,
    },
  ];
}

function buildRuntimeImporterViolations(
  project: ArchitectureProject,
  entry: ImportRecord,
  resolvedPath: string,
  sourcePolicy: ArchitectureDependencyPolicy,
  targetPolicy: ArchitectureDependencyPolicy,
): ArchitectureViolation[] {
  if (targetPolicy.surfaceTier !== "private-runtime") {
    return [];
  }

  if (sourcePolicy.name === targetPolicy.name) {
    return [];
  }

  const allowsSourcePolicy =
    targetPolicy.allowedRuntimeImporters?.includes(sourcePolicy.name) ?? false;

  if (allowsSourcePolicy) {
    return [];
  }

  const allowedImporters = targetPolicy.allowedRuntimeImporters ?? [];

  return [
    {
      code: "runtime-importer-allowlist",
      message: `${entry.sourcePath} imports runtime-only module ${resolvedPath}; runtime modules may only be imported from ${allowedImporters.length > 0 ? allowedImporters.join(", ") : "declared runtime importer surfaces"}`,
    },
  ];
}

function buildSurfaceTierDependencyViolations(
  sourcePolicy: ArchitectureDependencyPolicy,
  targetPolicy: ArchitectureDependencyPolicy,
  sourcePath: string,
  resolvedPath: string,
): ArchitectureViolation[] {
  return sourcePolicy.surfaceTier === "public" &&
    targetPolicy.surfaceTier === "private-runtime"
    ? [
        {
          code: "surface-tier-dependency",
          message: `${sourcePath} (${sourcePolicy.name}) depends on ${resolvedPath} (${targetPolicy.name}); public-tier surfaces must not depend on private-runtime tiers`,
        },
      ]
    : [];
}

function buildTypeOnlyPolicyViolations(
  project: ArchitectureProject,
  entry: ImportRecord,
  resolvedPath: string,
  sourcePolicy: ArchitectureDependencyPolicy,
  targetPolicy: ArchitectureDependencyPolicy,
): ArchitectureViolation[] {
  if (
    !project.config.requireTypeOnlyImportsForTypeOnlyPolicies ||
    sourcePolicy.name === targetPolicy.name ||
    !targetPolicy.isTypeOnly ||
    entry.isTypeOnly
  ) {
    return [];
  }

  const verb = entry.isReExport ? "re-export" : "import";
  return [
    {
      code: "type-only-policy-import",
      message: `${entry.sourcePath} uses a value ${verb} for ${resolvedPath}; ${targetPolicy.name} is declared type-only, so cross-boundary references must use type-only syntax`,
    },
  ];
}
