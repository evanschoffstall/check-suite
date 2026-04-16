/**
 * Parses a number or string value into a positive integer millisecond count.
 * Returns `null` when the value is absent, non-positive, or unparseable.
 */
export function parsePositiveTimeoutMs(
  value: number | string | undefined,
): null | number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
  }
  if (typeof value !== "string") return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Resolves the effective timeout from an optional env var, a configured value,
 * and a hard-coded fallback — in that priority order.
 */
export function resolveTimeoutMs(
  envVarName: string,
  configuredMs: number | undefined,
  fallbackMs: number,
): number {
  return (
    (envVarName ? parsePositiveTimeoutMs(process.env[envVarName]) : null) ??
    parsePositiveTimeoutMs(configuredMs) ??
    fallbackMs
  );
}
