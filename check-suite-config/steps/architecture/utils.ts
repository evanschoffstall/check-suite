function getCodeStem(fileName: string): string {
  return fileName.replace(/\.(?:d\.)?(?:[cm]?[jt]sx?)$/u, "");
}

/** Returns the last path segment from a normalized repo-relative path. */
function getLastPathSegment(path: string): string {
  const segments = normalizePath(path).split("/").filter(Boolean);
  return segments.at(-1) ?? path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePath(value: string): string {
  return value.split("\\").join("/");
}

/** Parses an integer config value when it satisfies a minimum threshold. */
function toIntegerAtLeast(value: unknown, minimum: number): null | number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum
    ? value
    : null;
}

/** Parses a list of `{ name, patterns }` layer-group objects from unknown config input. */
function toLayerPatternGroups(
  value: unknown,
): null | { name: string; patterns: string[] }[] {
  if (!Array.isArray(value)) {
    return null;
  }

  const groups = value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const name = entry.name;
      const patterns = toStringList(entry.patterns);

      return typeof name === "string" && name.length > 0 && patterns !== null
        ? { name, patterns }
        : null;
    })
    .filter(
      (
        entry,
      ): entry is {
        name: string;
        patterns: string[];
      } => entry !== null,
    );

  return groups.length === value.length ? groups : null;
}

function toStringList(value: unknown): null | string[] {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function trimLeadingDotSlash(value: string): string {
  return value.startsWith("./") ? value.slice(2) : value;
}

export {
  getCodeStem,
  getLastPathSegment,
  isRecord,
  normalizePath,
  toIntegerAtLeast,
  toLayerPatternGroups,
  toStringList,
  trimLeadingDotSlash,
};
