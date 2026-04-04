import type { PostProcessTone } from "@/types/index.ts";

export function isOptionalStatus(
  value: unknown,
): value is "fail" | "pass" | undefined {
  return value === undefined || value === "fail" || value === "pass";
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function normalizeArray<T>(
  value: unknown,
  mapEntry: (entry: unknown) => null | T,
): null | T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  return value.map(mapEntry).filter((entry): entry is T => entry !== null);
}

export function normalizeTone(value: unknown): PostProcessTone | undefined {
  return value === "fail" ||
    value === "info" ||
    value === "pass" ||
    value === "warn"
    ? value
    : undefined;
}
