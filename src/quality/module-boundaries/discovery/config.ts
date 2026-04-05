import { join } from "node:path";

import type {
  ArchitectureAnalyzerConfig,
  CodeRoots,
} from "@/quality/module-boundaries/foundation/index.ts";

import {
  isRecord,
  normalizeBooleanConfig,
  normalizeDependencyPolicies,
  normalizeIntegerConfig,
  normalizeLayerGroups,
  normalizeStringListConfig,
} from "@/quality/module-boundaries/discovery/normalization.ts";
import {
  DEFAULT_ALLOW_PUBLIC_SURFACE_RE_EXPORT_CHAINS,
  DEFAULT_ALLOWED_IMPURE_PUBLIC_SURFACE_PATHS,
  DEFAULT_ALLOWED_ROOT_FILE_STEMS,
  DEFAULT_CENTRAL_SURFACE_PATH_PREFIXES,
  DEFAULT_ENTRYPOINT_NAMES,
  DEFAULT_EXPLICIT_PUBLIC_SURFACE_PATHS,
  DEFAULT_IGNORED_DIRECTORY_NAMES,
  DEFAULT_JUNK_DRAWER_DIRECTORY_NAMES,
  DEFAULT_JUNK_DRAWER_FILE_STEMS,
  DEFAULT_MAX_CENTRAL_SURFACE_EXPORTS,
  DEFAULT_MAX_DIRECTORY_DEPTH,
  DEFAULT_MAX_ENTRYPOINT_RE_EXPORTS,
  DEFAULT_MAX_INTERNAL_IMPORTS,
  DEFAULT_MAX_POLICY_FAN_OUT,
  DEFAULT_MAX_SIBLING_IMPORTS,
  DEFAULT_MAX_WILDCARD_EXPORTS_PER_PUBLIC_SURFACE,
  DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
  DEFAULT_REQUIRE_ACYCLIC_DEPENDENCY_POLICIES,
  DEFAULT_REQUIRE_COMPLETE_DEPENDENCY_POLICY_COVERAGE,
  DEFAULT_REQUIRE_TYPE_ONLY_IMPORTS_FOR_TYPE_ONLY_POLICIES,
  DEFAULT_SHARED_HOME_NAMES,
  DEFAULT_TEST_DIRECTORY_NAMES,
  DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES,
} from "@/quality/module-boundaries/foundation/index.ts";
import {
  directoryContainsCode,
  isIgnoredDirectory,
  isIncludedCodeFile,
  safeReadDir,
} from "@/quality/module-boundaries/scan/index.ts";

/** Adds one root-level directory or file to the discovered code roots when applicable. */
export function collectRootEntry(
  cwd: string,
  config: Required<ArchitectureAnalyzerConfig>,
  roots: { directories: string[]; files: string[] },
  entry: { isDirectory(): boolean; isFile(): boolean; name: string },
): void {
  if (entry.isDirectory()) {
    if (
      config.rootDirectories.length > 0 &&
      !config.rootDirectories.includes(entry.name)
    ) {
      return;
    }

    if (
      isIgnoredDirectory(entry.name, config) ||
      config.testDirectoryNames.includes(entry.name)
    ) {
      return;
    }

    if (directoryContainsCode(join(cwd, entry.name), config)) {
      roots.directories.push(entry.name);
    }

    return;
  }

  if (
    config.includeRootFiles &&
    entry.isFile() &&
    isIncludedCodeFile(entry.name)
  ) {
    roots.files.push(entry.name);
  }
}

/** Discovers root code directories and root code files for the current repository. */
export function discoverCodeRoots(
  cwd: string,
  config: Required<ArchitectureAnalyzerConfig>,
): CodeRoots {
  const directories: string[] = [];
  const files: string[] = [];
  const roots = { directories, files };

  for (const entry of safeReadDir(cwd)) {
    collectRootEntry(cwd, config, roots, entry);
  }

  return { directories: directories.sort(), files: files.sort() };
}

/** Returns the normalized analyzer config, filling in generic defaults. */
export function normalizeArchitectureConfig(
  value: unknown,
): Required<ArchitectureAnalyzerConfig> {
  const record = isRecord(value) ? value : {};

  return {
    ...normalizeRootScopeConfig(record),
    ...normalizeDirectoryNameConfig(record),
    ...normalizeThresholdConfig(record),
    layerGroups: normalizeLayerGroups(record.layerGroups),
  };
}

function normalizeDirectoryNameConfig(
  record: Record<string, unknown>,
): Pick<
  Required<ArchitectureAnalyzerConfig>,
  | "allowedImpurePublicSurfacePaths"
  | "allowedRootFileStems"
  | "allowPublicSurfaceReExportChains"
  | "centralSurfacePathPrefixes"
  | "dependencyPolicies"
  | "entrypointNames"
  | "explicitPublicSurfacePaths"
  | "ignoredDirectoryNames"
  | "junkDrawerDirectoryNames"
  | "junkDrawerFileStems"
  | "requireAcyclicDependencyPolicies"
  | "requireCompleteDependencyPolicyCoverage"
  | "requireTypeOnlyImportsForTypeOnlyPolicies"
  | "sharedHomeNames"
  | "testDirectoryNames"
  | "vendorManagedDirectoryNames"
> {
  return {
    ...normalizePublicSurfaceConfig(record),
    ...normalizeDirectoryNamingConfig(record),
    ...normalizePolicyConfig(record),
  };
}

function normalizeDirectoryNamingConfig(
  record: Record<string, unknown>,
): Pick<
  Required<ArchitectureAnalyzerConfig>,
  | "allowedRootFileStems"
  | "ignoredDirectoryNames"
  | "junkDrawerDirectoryNames"
  | "junkDrawerFileStems"
  | "sharedHomeNames"
  | "testDirectoryNames"
  | "vendorManagedDirectoryNames"
> {
  return {
    allowedRootFileStems: normalizeStringListConfig(
      record.allowedRootFileStems,
      DEFAULT_ALLOWED_ROOT_FILE_STEMS,
    ),
    ignoredDirectoryNames: normalizeStringListConfig(
      record.ignoredDirectoryNames,
      DEFAULT_IGNORED_DIRECTORY_NAMES,
    ),
    junkDrawerDirectoryNames: normalizeStringListConfig(
      record.junkDrawerDirectoryNames,
      DEFAULT_JUNK_DRAWER_DIRECTORY_NAMES,
    ),
    junkDrawerFileStems: normalizeStringListConfig(
      record.junkDrawerFileStems,
      DEFAULT_JUNK_DRAWER_FILE_STEMS,
    ),
    sharedHomeNames: normalizeStringListConfig(
      record.sharedHomeNames,
      DEFAULT_SHARED_HOME_NAMES,
    ),
    testDirectoryNames: normalizeStringListConfig(
      record.testDirectoryNames,
      DEFAULT_TEST_DIRECTORY_NAMES,
    ),
    vendorManagedDirectoryNames: normalizeStringListConfig(
      record.vendorManagedDirectoryNames,
      DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES,
    ),
  };
}

function normalizePolicyConfig(
  record: Record<string, unknown>,
): Pick<
  Required<ArchitectureAnalyzerConfig>,
  | "dependencyPolicies"
  | "entrypointNames"
  | "requireAcyclicDependencyPolicies"
  | "requireCompleteDependencyPolicyCoverage"
  | "requireTypeOnlyImportsForTypeOnlyPolicies"
> {
  return {
    dependencyPolicies: normalizeDependencyPolicies(record.dependencyPolicies),
    entrypointNames: normalizeStringListConfig(
      record.entrypointNames,
      DEFAULT_ENTRYPOINT_NAMES,
    ),
    requireAcyclicDependencyPolicies: normalizeBooleanConfig(
      record.requireAcyclicDependencyPolicies,
      DEFAULT_REQUIRE_ACYCLIC_DEPENDENCY_POLICIES,
    ),
    requireCompleteDependencyPolicyCoverage: normalizeBooleanConfig(
      record.requireCompleteDependencyPolicyCoverage,
      DEFAULT_REQUIRE_COMPLETE_DEPENDENCY_POLICY_COVERAGE,
    ),
    requireTypeOnlyImportsForTypeOnlyPolicies: normalizeBooleanConfig(
      record.requireTypeOnlyImportsForTypeOnlyPolicies,
      DEFAULT_REQUIRE_TYPE_ONLY_IMPORTS_FOR_TYPE_ONLY_POLICIES,
    ),
  };
}

function normalizePublicSurfaceConfig(
  record: Record<string, unknown>,
): Pick<
  Required<ArchitectureAnalyzerConfig>,
  | "allowedImpurePublicSurfacePaths"
  | "allowPublicSurfaceReExportChains"
  | "centralSurfacePathPrefixes"
  | "explicitPublicSurfacePaths"
> {
  return {
    allowedImpurePublicSurfacePaths: normalizeStringListConfig(
      record.allowedImpurePublicSurfacePaths,
      DEFAULT_ALLOWED_IMPURE_PUBLIC_SURFACE_PATHS,
    ),
    allowPublicSurfaceReExportChains: normalizeBooleanConfig(
      record.allowPublicSurfaceReExportChains,
      DEFAULT_ALLOW_PUBLIC_SURFACE_RE_EXPORT_CHAINS,
    ),
    centralSurfacePathPrefixes: normalizeStringListConfig(
      record.centralSurfacePathPrefixes,
      DEFAULT_CENTRAL_SURFACE_PATH_PREFIXES,
    ),
    explicitPublicSurfacePaths: normalizeStringListConfig(
      record.explicitPublicSurfacePaths,
      DEFAULT_EXPLICIT_PUBLIC_SURFACE_PATHS,
    ),
  };
}

function normalizeRootScopeConfig(
  record: Record<string, unknown>,
): Pick<
  Required<ArchitectureAnalyzerConfig>,
  "includeRootFiles" | "rootDirectories"
> {
  return {
    includeRootFiles:
      typeof record.includeRootFiles === "boolean"
        ? record.includeRootFiles
        : true,
    rootDirectories: normalizeStringListConfig(record.rootDirectories, []),
  };
}

function normalizeThresholdConfig(
  record: Record<string, unknown>,
): Pick<
  Required<ArchitectureAnalyzerConfig>,
  | "maxCentralSurfaceExports"
  | "maxDirectoryDepth"
  | "maxEntrypointReExports"
  | "maxInternalImportsPerFile"
  | "maxPolicyFanOut"
  | "maxSiblingImports"
  | "maxWildcardExportsPerPublicSurface"
  | "minRepeatedDeepImports"
> {
  return {
    maxCentralSurfaceExports: normalizeIntegerConfig(
      record.maxCentralSurfaceExports,
      1,
      DEFAULT_MAX_CENTRAL_SURFACE_EXPORTS,
    ),
    maxDirectoryDepth: normalizeIntegerConfig(
      record.maxDirectoryDepth,
      1,
      DEFAULT_MAX_DIRECTORY_DEPTH,
    ),
    maxEntrypointReExports: normalizeIntegerConfig(
      record.maxEntrypointReExports,
      1,
      DEFAULT_MAX_ENTRYPOINT_RE_EXPORTS,
    ),
    maxInternalImportsPerFile: normalizeIntegerConfig(
      record.maxInternalImportsPerFile,
      1,
      DEFAULT_MAX_INTERNAL_IMPORTS,
    ),
    maxPolicyFanOut: normalizeIntegerConfig(
      record.maxPolicyFanOut,
      1,
      DEFAULT_MAX_POLICY_FAN_OUT,
    ),
    maxSiblingImports: normalizeIntegerConfig(
      record.maxSiblingImports,
      1,
      DEFAULT_MAX_SIBLING_IMPORTS,
    ),
    maxWildcardExportsPerPublicSurface: normalizeIntegerConfig(
      record.maxWildcardExportsPerPublicSurface,
      0,
      DEFAULT_MAX_WILDCARD_EXPORTS_PER_PUBLIC_SURFACE,
    ),
    minRepeatedDeepImports: normalizeIntegerConfig(
      record.minRepeatedDeepImports,
      2,
      DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
    ),
  };
}
