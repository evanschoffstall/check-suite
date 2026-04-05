/** Formats one parsed test case into the repository's human-readable result string. */
export function formatTestResult(test: {
  file?: string;
  line?: string;
  message?: string;
  name?: string;
  suite?: string;
}): string {
  return `${test.file ?? "unknown-file"}${test.line ? `:${test.line}` : ""} - ${test.suite ? `${test.suite} > ` : ""}${test.name ?? "(unnamed test)"}${test.message ? ` [${test.message}]` : ""}`;
}

/** Parses a shallow set of XML attributes from a raw tag fragment. */
export function readXmlAttributes(
  raw: string,
): Partial<Record<string, string>> {
  return Object.fromEntries(
    [...raw.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]]),
  );
}
