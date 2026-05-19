/** Builds a number-valued record from whitespace-delimited `key=value` assignments. */
export function defineNumberRecord(value: string): Record<string, number> {
  return Object.fromEntries(
    parseAssignments(value).map(([key, rawValue]) => [key, Number(rawValue)]),
  );
}

/** Converts whitespace-delimited `key=value` assignments into typed entries. */
export function parseAssignments(value: string): [string, string][] {
  return value
    .split(/\s+/u)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex < 1) {
        throw new Error(`invalid assignment: ${entry}`);
      }
      return [entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)];
    });
}
