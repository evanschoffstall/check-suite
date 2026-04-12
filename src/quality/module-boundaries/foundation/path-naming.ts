import type {
  ArchitectureEntrypointRule,
  NormalizedArchitectureAnalyzerConfig,
} from "./types";

/** Returns whether a configured entrypoint may legally coexist with peers. */
function entrypointAllowsSiblingEntrypoints(
  config: Pick<NormalizedArchitectureAnalyzerConfig, "entrypointRules">,
  stem: string,
): boolean {
  return (
    getArchitectureEntrypointRule(config, stem)?.allowSiblingEntrypoints ?? false
  );
}

/** Returns whether a configured entrypoint may contain top-level statements. */
function entrypointAllowsTopLevelStatements(
  config: Pick<NormalizedArchitectureAnalyzerConfig, "entrypointRules">,
  stem: string,
): boolean {
  return getArchitectureEntrypointRule(config, stem)?.allowTopLevelStatements ?? false;
}

/** Looks up the configured architectural entrypoint rule for a given file stem. */
function getArchitectureEntrypointRule(
  config: Pick<NormalizedArchitectureAnalyzerConfig, "entrypointRules">,
  stem: string,
): ArchitectureEntrypointRule | null {
  return (
    config.entrypointRules.find((entrypointRule) => entrypointRule.name === stem) ??
    null
  );
}

function getCodeStem(fileName: string): string {
  return fileName.replace(/\.(?:d\.)?(?:[cm]?[jt]sx?)$/u, "");
}

/** Returns the last path segment from a normalized repo-relative path. */
function getLastPathSegment(path: string): string {
  const segments = normalizePath(path).split("/").filter(Boolean);
  return segments.at(-1) ?? path;
}

/** Returns whether the configured architecture model treats a stem as an entrypoint. */
function isArchitectureEntrypoint(
  config: Pick<NormalizedArchitectureAnalyzerConfig, "entrypointRules">,
  stem: string,
): boolean {
  return getArchitectureEntrypointRule(config, stem) !== null;
}

function normalizePath(value: string): string {
  return value.split("\\").join("/");
}

function trimLeadingDotSlash(value: string): string {
  return value.startsWith("./") ? value.slice(2) : value;
}

export {
  entrypointAllowsSiblingEntrypoints,
  entrypointAllowsTopLevelStatements,
  getArchitectureEntrypointRule,
  getCodeStem,
  getLastPathSegment,
  isArchitectureEntrypoint,
  normalizePath,
  trimLeadingDotSlash,
};
