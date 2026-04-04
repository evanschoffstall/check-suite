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
    entrypointNames: toStringList(record.entrypointNames) ?? [
      ...DEFAULT_ENTRYPOINT_NAMES,
    ],
    ignoredDirectoryNames: toStringList(record.ignoredDirectoryNames) ?? [
      ...DEFAULT_IGNORED_DIRECTORY_NAMES,
    ],
    junkDrawerDirectoryNames: toStringList(record.junkDrawerDirectoryNames) ?? [
      ...DEFAULT_JUNK_DRAWER_DIRECTORY_NAMES,
    ],
    junkDrawerFileStems: toStringList(record.junkDrawerFileStems) ?? [
      ...DEFAULT_JUNK_DRAWER_FILE_STEMS,
    ],
    layerGroups:
      toLayerPatternGroups(record.layerGroups) ??
      DEFAULT_LAYER_GROUPS.map((group) => ({
        name: group.name,
        patterns: [...group.patterns],
      })),
    maxEntrypointReExports:
      toIntegerAtLeast(record.maxEntrypointReExports, 1) ??
      DEFAULT_MAX_ENTRYPOINT_RE_EXPORTS,
    maxInternalImportsPerFile:
      toIntegerAtLeast(record.maxInternalImportsPerFile, 1) ??
      DEFAULT_MAX_INTERNAL_IMPORTS,
    maxSiblingImports:
      toIntegerAtLeast(record.maxSiblingImports, 1) ??
      DEFAULT_MAX_SIBLING_IMPORTS,
    minRepeatedDeepImports:
      toIntegerAtLeast(record.minRepeatedDeepImports, 2) ??
      DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
    sharedHomeNames: toStringList(record.sharedHomeNames) ?? [
      ...DEFAULT_SHARED_HOME_NAMES,
    ],
    vendorManagedDirectoryNames: toStringList(
      record.vendorManagedDirectoryNames,
    ) ?? [...DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES],
  };
}
