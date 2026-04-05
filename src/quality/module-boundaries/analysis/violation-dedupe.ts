import type { ArchitectureViolation } from "@/quality/module-boundaries/foundation/index.ts";

/** Removes duplicate architecture violations while preserving first-seen order. */
export function dedupeArchitectureViolations(
  violations: ArchitectureViolation[],
): ArchitectureViolation[] {
  const seen = new Set<string>();

  return violations.filter((violation) => {
    const key = `${violation.code}:${violation.message}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
