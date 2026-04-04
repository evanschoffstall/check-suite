import { join } from "node:path";

import type {
  ArchitectureAnalyzerConfig,
  ArchitectureProject,
  CodeRoots,
} from "./types.ts";

import { discoverAliasMappings } from "./alias-mappings.ts";
import {
  DEFAULT_ENTRYPOINT_NAMES,
  DEFAULT_IGNORED_DIRECTORY_NAMES,
  DEFAULT_MAX_SIBLING_IMPORTS,
  DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
  DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES,
  TEST_DIRECTORY_NAMES,
} from "./constants.ts";
import { collectImports } from "./import-collection.ts";
import {
  collectCodeFiles,
  collectDirectories,
  discoverBoundaryDirectories,
} from "./layout.ts";
import {
  directoryContainsCode,
  isIgnoredDirectory,
  isIncludedCodeFile,
  safeReadDir,
} from "./scan.ts";
import { isRecord, toStringList } from "./utils.ts";

// ---------------------------------------------------------------------------
// Config normalization
// ---------------------------------------------------------------------------

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
    if (directoryContainsCode(join(cwd, entry.name), config))
      roots.directories.push(entry.name);
    return;
  }

  if (entry.isFile() && isIncludedCodeFile(entry.name))
    roots.files.push(entry.name);
}

// ---------------------------------------------------------------------------
// Root-entry collection (single directory entry → code roots)
// ---------------------------------------------------------------------------

/** Discovers the code roots, boundaries, aliases, files, and imports in a repository. */
export function discoverArchitectureProject(
  cwd: string,
  config: Required<ArchitectureAnalyzerConfig>,
): ArchitectureProject {
  const codeRoots = discoverCodeRoots(cwd, config);
  const aliasMappings = discoverAliasMappings(cwd, codeRoots);
  const boundaries = discoverBoundaryDirectories(cwd, codeRoots, config);
  const files = collectCodeFiles(cwd, codeRoots, config);

  return {
    aliasMappings,
    boundaries,
    codeRoots,
    config,
    directories: collectDirectories(cwd, codeRoots, config),
    files,
    imports: collectImports(cwd, files, aliasMappings),
  };
}

// ---------------------------------------------------------------------------
// Code root discovery
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Project discovery
// ---------------------------------------------------------------------------

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
    maxSiblingImports:
      typeof record.maxSiblingImports === "number" &&
      Number.isInteger(record.maxSiblingImports) &&
      record.maxSiblingImports >= 1
        ? record.maxSiblingImports
        : DEFAULT_MAX_SIBLING_IMPORTS,
    minRepeatedDeepImports:
      typeof record.minRepeatedDeepImports === "number" &&
      Number.isInteger(record.minRepeatedDeepImports) &&
      record.minRepeatedDeepImports >= 2
        ? record.minRepeatedDeepImports
        : DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
    vendorManagedDirectoryNames: toStringList(
      record.vendorManagedDirectoryNames,
    ) ?? [...DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES],
  };
}
