import { statSync } from "node:fs";
import { join } from "node:path";

import type {
  ArchitectureCodeTargetsConfig,
  ArchitectureEntrypointRule,
  CodeRoots,
  NormalizedArchitectureAnalyzerConfig,
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
  isTestDirectory,
  safeReadDir,
} from "@/quality/module-boundaries/scan/index.ts";

import { flattenArchitectureConfigSections } from "./grouped-config.ts";

/** Adds one root-level directory or file to the discovered code roots when applicable. */
export function collectRootEntry(
  cwd: string,
  config: NormalizedArchitectureAnalyzerConfig,
  roots: { directories: string[]; files: string[] },
  entry: { isDirectory(): boolean; isFile(): boolean; name: string },
): void {
  if (entry.isDirectory()) {
    if (isIgnoredDirectory(entry.name, config) || isTestDirectory(entry.name, config)) {
      return;
    }

    if (directoryContainsCode(join(cwd, entry.name), config, entry.name)) {
      roots.directories.push(entry.name);
    }

    return;
  }

  if (entry.isFile() && isIncludedCodeFile(entry.name, config)) {
    roots.files.push(entry.name);
  }
}

/** Discovers root code directories and root code files for the current repository. */
export function discoverCodeRoots(
  cwd: string,
  config: NormalizedArchitectureAnalyzerConfig,
): CodeRoots {
  const directories: string[] = [];
  const files: string[] = [];
  const roots = { directories, files };

  if (config.rootDirectories.length > 0) {
    for (const rootDirectory of config.rootDirectories) {
      collectConfiguredRoot(cwd, config, roots, rootDirectory);
    }

    return {
      directories: [...new Set(directories)].sort(),
      files: [...new Set(files)].sort(),
    };
  }

  for (const entry of safeReadDir(cwd)) {
    collectRootEntry(cwd, config, roots, entry);
  }

  return { directories: directories.sort(), files: files.sort() };
}

/**
 * Discovers the top-level source directories for a given working directory
 * using the caller-provided code-target and directory-skip configuration.
 *
 * The returned `directories` list is suitable as a source-scan target for any
 * platform step that needs to know which directories contain project code.
 */
export function discoverDefaultCodeRoots(cwd: string, configValue?: unknown): CodeRoots {
  return discoverCodeRoots(cwd, normalizeArchitectureConfig(configValue ?? {}));
}

/** Returns the normalized analyzer config, filling in generic defaults. */
export function normalizeArchitectureConfig(
  value: unknown,
): NormalizedArchitectureAnalyzerConfig {
  const record = flattenArchitectureConfigSections(value);

  return {
    ...normalizeRootScopeConfig(record),
    ...normalizeDirectoryNameConfig(record),
    ...normalizeThresholdConfig(record),
    layerGroups: normalizeLayerGroups(record.layerGroups),
  };
}

/** Adds one explicitly configured scan root when rootDirectories is provided. */
function collectConfiguredRoot(
  cwd: string,
  config: NormalizedArchitectureAnalyzerConfig,
  roots: CodeRoots,
  rootDirectory: string,
): void {
  const normalizedRootDirectory = rootDirectory
    .replace(/^\.\//u, "")
    .replace(/\/+$/u, "");

  if (normalizedRootDirectory.length === 0 || normalizedRootDirectory === ".") {
    for (const entry of safeReadDir(cwd)) {
      collectRootEntry(cwd, config, roots, entry);
    }
    return;
  }

  if (
    isIgnoredDirectory(normalizedRootDirectory, config) ||
    isTestDirectory(normalizedRootDirectory, config)
  ) {
    return;
  }

  const absoluteRootPath = join(cwd, normalizedRootDirectory);

  try {
    if (!statSync(absoluteRootPath).isDirectory()) {
      return;
    }
  } catch {
    return;
  }

  if (directoryContainsCode(absoluteRootPath, config, normalizedRootDirectory)) {
    roots.directories.push(normalizedRootDirectory);
  }
}

/** Normalizes file-target overrides that define which files count as code. */
function normalizeCodeTargetsConfig(value: unknown): Required<ArchitectureCodeTargetsConfig> {
  const record = isRecord(value) ? value : {};

  return {
    declarationFilePatterns: normalizeStringListConfig(
      record.declarationFilePatterns,
      [],
    ),
    includePatterns: normalizeStringListConfig(record.includePatterns, []),
    resolutionEntrypointNames: normalizeStringListConfig(
      record.resolutionEntrypointNames,
      [],
    ),
    resolutionExtensions: normalizeStringListConfig(
      record.resolutionExtensions,
      [],
    ),
    testFilePatterns: normalizeStringListConfig(record.testFilePatterns, []),
  };
}

function normalizeDirectoryNameConfig(
  record: Record<string, unknown>,
): Pick<
  NormalizedArchitectureAnalyzerConfig,
  | "allowedImpurePublicSurfacePaths"
  | "allowedRootFileStems"
  | "allowPublicSurfaceReExportChains"
  | "centralSurfacePathPrefixes"
  | "codeTargets"
  | "dependencyPolicies"
  | "enforceConsistentFileNameCase"
  | "entrypointNames"
  | "entrypointRules"
  | "explicitPublicSurfacePaths"
  | "fileNameCaseIgnoreFileGlobs"
  | "fileNameCaseIgnorePathGlobs"
  | "ignoredDirectories"
  | "junkDrawerDirectoryNames"
  | "junkDrawerFileNamePatterns"
  | "junkDrawerFileStems"
  | "requireAcyclicDependencyPolicies"
  | "requireCompleteDependencyPolicyCoverage"
  | "requireTypeOnlyImportsForTypeOnlyPolicies"
  | "sharedHomeNames"
  | "testDirectories"
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
  NormalizedArchitectureAnalyzerConfig,
  | "allowedRootFileStems"
  | "codeTargets"
  | "enforceConsistentFileNameCase"
  | "fileNameCaseIgnoreFileGlobs"
  | "fileNameCaseIgnorePathGlobs"
  | "ignoredDirectories"
  | "junkDrawerDirectoryNames"
  | "junkDrawerFileNamePatterns"
  | "junkDrawerFileStems"
  | "sharedHomeNames"
  | "testDirectories"
> {
  return {
    allowedRootFileStems: normalizeStringListConfig(
      record.allowedRootFileStems,
      architectureDefaults.DEFAULT_ALLOWED_ROOT_FILE_STEMS,
    ),
    codeTargets: normalizeCodeTargetsConfig(record.codeTargets),
    enforceConsistentFileNameCase: normalizeBooleanConfig(
      record.enforceConsistentFileNameCase,
      architectureDefaults.DEFAULT_ENFORCE_CONSISTENT_FILE_NAME_CASE,
    ),
    fileNameCaseIgnoreFileGlobs: normalizeStringListConfig(
      record.fileNameCaseIgnoreFileGlobs,
      architectureDefaults.DEFAULT_FILE_NAME_CASE_IGNORE_FILE_GLOBS,
    ),
    fileNameCaseIgnorePathGlobs: normalizeStringListConfig(
      record.fileNameCaseIgnorePathGlobs,
      architectureDefaults.DEFAULT_FILE_NAME_CASE_IGNORE_PATH_GLOBS,
    ),
    ignoredDirectories: normalizeStringListConfig(
      record.ignoredDirectories,
      [],
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
    testDirectories: normalizeStringListConfig(
      record.testDirectories,
      [],
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
  NormalizedArchitectureAnalyzerConfig,
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
  NormalizedArchitectureAnalyzerConfig,
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
  NormalizedArchitectureAnalyzerConfig,
  "rootDirectories"
> {
  return {
    rootDirectories: normalizeStringListConfig(record.rootDirectories, []),
  };
}

function normalizeThresholdConfig(
  record: Record<string, unknown>,
): Pick<
  NormalizedArchitectureAnalyzerConfig,
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

