import { join } from "node:path";

import type {
  ArchitectureAnalyzerConfig,
  ArchitectureEntrypointRule,
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
import * as architectureDefaults from "@/quality/module-boundaries/foundation/index.ts";
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

/**
 * Discovers the top-level source directories for a given working directory
 * using the platform's conventional exclusion defaults (build artefacts, test
 * folders, tool caches, package managers, framework output, etc.).
 *
 * The returned `directories` list is suitable as a source-scan target for any
 * platform step that needs to know which directories contain project code,
 * without requiring the user to hardcode names like `"src"`.
 */
export function discoverDefaultCodeRoots(cwd: string): CodeRoots {
  return discoverCodeRoots(
    cwd,
    normalizeArchitectureConfig({ includeRootFiles: false }),
  );
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
  | "entrypointRules"
  | "explicitPublicSurfacePaths"
  | "ignoredDirectoryNames"
  | "junkDrawerDirectoryNames"
  | "junkDrawerFileNamePatterns"
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
  | "junkDrawerFileNamePatterns"
  | "junkDrawerFileStems"
  | "sharedHomeNames"
  | "testDirectoryNames"
  | "vendorManagedDirectoryNames"
> {
  return {
    allowedRootFileStems: normalizeStringListConfig(
      record.allowedRootFileStems,
      architectureDefaults.DEFAULT_ALLOWED_ROOT_FILE_STEMS,
    ),
    ignoredDirectoryNames: normalizeStringListConfig(
      record.ignoredDirectoryNames,
      architectureDefaults.DEFAULT_IGNORED_DIRECTORY_NAMES,
    ),
    junkDrawerDirectoryNames: normalizeStringListConfig(
      record.junkDrawerDirectoryNames,
      architectureDefaults.DEFAULT_JUNK_DRAWER_DIRECTORY_NAMES,
    ),
    junkDrawerFileNamePatterns: normalizeStringListConfig(
      record.junkDrawerFileNamePatterns,
      architectureDefaults.DEFAULT_JUNK_DRAWER_FILE_NAME_PATTERNS,
    ),
    junkDrawerFileStems: normalizeStringListConfig(
      record.junkDrawerFileStems,
      architectureDefaults.DEFAULT_JUNK_DRAWER_FILE_STEMS,
    ),
    sharedHomeNames: normalizeStringListConfig(
      record.sharedHomeNames,
      architectureDefaults.DEFAULT_SHARED_HOME_NAMES,
    ),
    testDirectoryNames: normalizeStringListConfig(
      record.testDirectoryNames,
      architectureDefaults.DEFAULT_TEST_DIRECTORY_NAMES,
    ),
    vendorManagedDirectoryNames: normalizeStringListConfig(
      record.vendorManagedDirectoryNames,
      architectureDefaults.DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES,
    ),
  };
}

function normalizeEntrypointRules(
  record: Record<string, unknown>,
): ArchitectureEntrypointRule[] {
  const defaultRules = normalizeStringListConfig(
    record.entrypointNames,
    architectureDefaults.DEFAULT_ENTRYPOINT_NAMES,
  ).map((name) => ({
    allowSiblingEntrypoints: false,
    allowTopLevelStatements: false,
    name,
  }));
  const rulesByName = new Map(
    defaultRules.map((entrypointRule) => [entrypointRule.name, entrypointRule]),
  );

  if (!Array.isArray(record.entrypointRules)) {
    return [...rulesByName.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  for (const candidate of record.entrypointRules) {
    if (!isRecord(candidate)) {
      continue;
    }

    const rawName = candidate.name;
    if (typeof rawName !== "string") {
      continue;
    }

    const name = rawName.trim();
    if (name.length === 0) {
      continue;
    }

    const previousRule = rulesByName.get(name);
    rulesByName.set(name, {
      allowSiblingEntrypoints:
        typeof candidate.allowSiblingEntrypoints === "boolean"
          ? candidate.allowSiblingEntrypoints
          : previousRule?.allowSiblingEntrypoints ?? false,
      allowTopLevelStatements:
        typeof candidate.allowTopLevelStatements === "boolean"
          ? candidate.allowTopLevelStatements
          : previousRule?.allowTopLevelStatements ?? false,
      name,
    });
  }

  return [...rulesByName.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function normalizePolicyConfig(
  record: Record<string, unknown>,
): Pick<
  Required<ArchitectureAnalyzerConfig>,
  | "dependencyPolicies"
  | "entrypointNames"
  | "entrypointRules"
  | "requireAcyclicDependencyPolicies"
  | "requireCompleteDependencyPolicyCoverage"
  | "requireTypeOnlyImportsForTypeOnlyPolicies"
> {
  const entrypointRules = normalizeEntrypointRules(record);

  return {
    dependencyPolicies: normalizeDependencyPolicies(record.dependencyPolicies),
    entrypointNames: entrypointRules.map((entrypointRule) => entrypointRule.name),
    entrypointRules,
    requireAcyclicDependencyPolicies: normalizeBooleanConfig(
      record.requireAcyclicDependencyPolicies,
      architectureDefaults.DEFAULT_REQUIRE_ACYCLIC_DEPENDENCY_POLICIES,
    ),
    requireCompleteDependencyPolicyCoverage: normalizeBooleanConfig(
      record.requireCompleteDependencyPolicyCoverage,
      architectureDefaults.DEFAULT_REQUIRE_COMPLETE_DEPENDENCY_POLICY_COVERAGE,
    ),
    requireTypeOnlyImportsForTypeOnlyPolicies: normalizeBooleanConfig(
      record.requireTypeOnlyImportsForTypeOnlyPolicies,
      architectureDefaults.DEFAULT_REQUIRE_TYPE_ONLY_IMPORTS_FOR_TYPE_ONLY_POLICIES,
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
      architectureDefaults.DEFAULT_ALLOWED_IMPURE_PUBLIC_SURFACE_PATHS,
    ),
    allowPublicSurfaceReExportChains: normalizeBooleanConfig(
      record.allowPublicSurfaceReExportChains,
      architectureDefaults.DEFAULT_ALLOW_PUBLIC_SURFACE_RE_EXPORT_CHAINS,
    ),
    centralSurfacePathPrefixes: normalizeStringListConfig(
      record.centralSurfacePathPrefixes,
      architectureDefaults.DEFAULT_CENTRAL_SURFACE_PATH_PREFIXES,
    ),
    explicitPublicSurfacePaths: normalizeStringListConfig(
      record.explicitPublicSurfacePaths,
      architectureDefaults.DEFAULT_EXPLICIT_PUBLIC_SURFACE_PATHS,
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
      architectureDefaults.DEFAULT_MAX_CENTRAL_SURFACE_EXPORTS,
    ),
    maxDirectoryDepth: normalizeIntegerConfig(
      record.maxDirectoryDepth,
      1,
      architectureDefaults.DEFAULT_MAX_DIRECTORY_DEPTH,
    ),
    maxEntrypointReExports: normalizeIntegerConfig(
      record.maxEntrypointReExports,
      1,
      architectureDefaults.DEFAULT_MAX_ENTRYPOINT_RE_EXPORTS,
    ),
    maxInternalImportsPerFile: normalizeIntegerConfig(
      record.maxInternalImportsPerFile,
      1,
      architectureDefaults.DEFAULT_MAX_INTERNAL_IMPORTS,
    ),
    maxPolicyFanOut: normalizeIntegerConfig(
      record.maxPolicyFanOut,
      1,
      architectureDefaults.DEFAULT_MAX_POLICY_FAN_OUT,
    ),
    maxSiblingImports: normalizeIntegerConfig(
      record.maxSiblingImports,
      1,
      architectureDefaults.DEFAULT_MAX_SIBLING_IMPORTS,
    ),
    maxWildcardExportsPerPublicSurface: normalizeIntegerConfig(
      record.maxWildcardExportsPerPublicSurface,
      0,
      architectureDefaults.DEFAULT_MAX_WILDCARD_EXPORTS_PER_PUBLIC_SURFACE,
    ),
    minRepeatedDeepImports: normalizeIntegerConfig(
      record.minRepeatedDeepImports,
      2,
      architectureDefaults.DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
    ),
  };
}
