function getCodeStem(fileName: string): string {
  return fileName.replace(/\.(?:d\.)?(?:[cm]?[jt]sx?)$/u, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePath(value: string): string {
  return value.split("\\").join("/");
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
  isRecord,
  normalizePath,
  toStringList,
  trimLeadingDotSlash,
};
