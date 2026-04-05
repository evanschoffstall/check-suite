function getCodeStem(fileName: string): string {
  return fileName.replace(/\.(?:d\.)?(?:[cm]?[jt]sx?)$/u, "");
}

/** Returns the last path segment from a normalized repo-relative path. */
function getLastPathSegment(path: string): string {
  const segments = normalizePath(path).split("/").filter(Boolean);
  return segments.at(-1) ?? path;
}

function normalizePath(value: string): string {
  return value.split("\\").join("/");
}

function trimLeadingDotSlash(value: string): string {
  return value.startsWith("./") ? value.slice(2) : value;
}

export { getCodeStem, getLastPathSegment, normalizePath, trimLeadingDotSlash };
