import { join } from "node:path";

import type { ArchitectureAnalyzerConfig, CodeRoots } from "./types.ts";

import {
  DEFAULT_ENTRYPOINT_NAMES,
  DEFAULT_IGNORED_DIRECTORY_NAMES,
  DEFAULT_JUNK_DRAWER_DIRECTORY_NAMES,
  DEFAULT_JUNK_DRAWER_FILE_STEMS,
  DEFAULT_LAYER_GROUPS,
  DEFAULT_MAX_ENTRYPOINT_RE_EXPORTS,
  DEFAULT_MAX_INTERNAL_IMPORTS,
  DEFAULT_MAX_SIBLING_IMPORTS,
  DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
  DEFAULT_SHARED_HOME_NAMES,
  DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES,
  TEST_DIRECTORY_NAMES,
} from "./constants.ts";
import {
  directoryContainsCode,
  isIgnoredDirectory,
  isIncludedCodeFile,
  safeReadDir,
} from "./scan.ts";
import {
  isRecord,
  toIntegerAtLeast,
  toLayerPatternGroups,
  toStringList,
} from "./utils.ts";

/** Adds one root-level directory or file to the discovered code roots when applicable. */
export function collectRootEntry(
  cwd: string,
  config: Required<ArchitectureAnalyzerConfig>,
  roots: { directories: string[]; files: string[] },
  entry: { isDirectory(): boolean; isFile(): boolean; name: string },
): void {
  if (entry.isDirectory()) {
    if (
      isIgnoredDirectory(entry.name, config) ||
      TEST_DIRECTORY_NAMES.has(entry.name)
    ) {
      return;
    }
    if (directoryContainsCode(join(cwd, entry.name), config)) {
      roots.directories.push(entry.name);
    }
    return;
  }

  if (entry.isFile() && isIncludedCodeFile(entry.name)) {
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
    ...normalizeDirectoryNameConfig(record),
    ...normalizeThresholdConfig(record),
    layerGroups: normalizeLayerGroups(record.layerGroups),
  };
}

function normalizeDirectoryNameConfig(
  record: Record<string, unknown>,
): Pick<
  Required<ArchitectureAnalyzerConfig>,
  | "entrypointNames"
  | "ignoredDirectoryNames"
  | "junkDrawerDirectoryNames"
  | "junkDrawerFileStems"
  | "sharedHomeNames"
  | "vendorManagedDirectoryNames"
> {
  return {
    entrypointNames: normalizeStringListConfig(
      record.entrypointNames,
      DEFAULT_ENTRYPOINT_NAMES,
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
    vendorManagedDirectoryNames: normalizeStringListConfig(
      record.vendorManagedDirectoryNames,
      DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES,
    ),
  };
}

function normalizeIntegerConfig(
  value: unknown,
  minimum: number,
  fallback: number,
): number {
  return toIntegerAtLeast(value, minimum) ?? fallback;
}

function normalizeLayerGroups(
  value: unknown,
): Required<ArchitectureAnalyzerConfig>["layerGroups"] {
  return (
    toLayerPatternGroups(value) ??
    DEFAULT_LAYER_GROUPS.map((group) => ({
      name: group.name,
      patterns: [...group.patterns],
    }))
  );
}

function normalizeStringListConfig(
  value: unknown,
  fallback: readonly string[],
): string[] {
  return toStringList(value) ?? [...fallback];
}

function normalizeThresholdConfig(
  record: Record<string, unknown>,
): Pick<
  Required<ArchitectureAnalyzerConfig>,
  | "maxEntrypointReExports"
  | "maxInternalImportsPerFile"
  | "maxSiblingImports"
  | "minRepeatedDeepImports"
> {
  return {
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
    maxSiblingImports: normalizeIntegerConfig(
      record.maxSiblingImports,
      1,
      DEFAULT_MAX_SIBLING_IMPORTS,
    ),
    minRepeatedDeepImports: normalizeIntegerConfig(
      record.minRepeatedDeepImports,
      2,
      DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
    ),
  };
}
