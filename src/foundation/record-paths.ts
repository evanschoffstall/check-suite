const unsafePathSegments = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Assigns a value inside a nested record using validated path segments.
 *
 * The helper creates null-prototype intermediate objects and rejects prototype
 * mutation keys so generic config parsers can safely accept dotted paths.
 */
export function assignNestedRecordValue(
  target: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): void {
  assignValidatedPath(target, validateRecordPath(path), value);
}

/** Reads a string array from a nested record path, returning an empty list otherwise. */
export function readStringArrayPath(value: unknown, path: string): string[] {
  const result = path.split(".").reduce((cursor, segment) => {
    if (Array.isArray(cursor) && /^\d+$/u.test(segment)) {
      return cursor[Number(segment)];
    }
    return isWritableRecord(cursor) ? cursor[segment] : undefined;
  }, value);

  return Array.isArray(result)
    ? result.filter((item): item is string => typeof item === "string")
    : [];
}

function assignValidatedPath(
  target: Record<string, unknown>,
  path: readonly [string, ...string[]],
  value: unknown,
): void {
  const [segment, ...rest] = path;
  if (rest.length === 0) {
    defineRecordValue(target, segment, value);
    return;
  }

  const next = target[segment];
  const child = isWritableRecord(next) ? next : createRecord();
  if (child !== next) {
    defineRecordValue(target, segment, child);
  }

  assignValidatedPath(child, rest as [string, ...string[]], value);
}

function createRecord(): Record<string, unknown> {
  return Object.create(null) as Record<string, unknown>;
}

function defineRecordValue(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function isWritableRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRecordPath(
  path: readonly string[],
): readonly [string, ...string[]] {
  if (path.length === 0) {
    throw new Error("record path must contain at least one segment");
  }

  for (const segment of path) {
    if (!segment || unsafePathSegments.has(segment)) {
      throw new Error(`unsafe record path segment: ${segment}`);
    }
  }

  return path as readonly [string, ...string[]];
}
