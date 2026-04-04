import { CFG } from "../config/index.ts";

export const SUITE_EXCLUSION_PREFIX = "---no=";

export function getConfiguredStepKeys(): string[] {
  return CFG.steps
    .filter((step) => step.enabled !== false)
    .map((step) => step.key);
}

export function getRunnableSuiteStepKeys(): Set<string> {
  return new Set(
    CFG.steps
      .filter((step) => !step.preRun && step.enabled !== false)
      .map((step) => step.key),
  );
}

export function parseSuiteExclusions(suiteArguments: string[]): {
  exclusions: string[];
  invalidExclusions: string[];
} {
  const exclusions: string[] = [];
  const invalidExclusions: string[] = [];

  for (const argument of suiteArguments) {
    if (!argument.startsWith(SUITE_EXCLUSION_PREFIX)) continue;

    const excludedKey = argument.slice(SUITE_EXCLUSION_PREFIX.length);
    if (excludedKey.length === 0) {
      invalidExclusions.push(argument);
      continue;
    }

    exclusions.push(excludedKey);
  }

  return { exclusions, invalidExclusions };
}
