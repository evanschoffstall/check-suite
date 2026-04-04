import type { StepConfig } from "./types/index.ts";

import { PATH_TOKENS } from "./config/index.ts";

// ---------------------------------------------------------------------------
// Token string substitution
// ---------------------------------------------------------------------------

/**
 * Resolves `{token}` placeholders in a string via the provided token map.
 * Unknown tokens are left as-is.
 */
export function resolveTokenString(
  value: string,
  tokens: Record<string, string>,
): string {
  return value.replace(
    /\{(\w+)\}/g,
    (whole: string, key: string) => tokens[`{${key}}`] ?? whole,
  );
}

/** Resolves `{token}` placeholders in each element of an args array. */
export const resolveArgs = (args: string[], tokens: Record<string, string>) =>
  args.map((argument) => resolveTokenString(argument, tokens));

// ---------------------------------------------------------------------------
// Step token map construction
// ---------------------------------------------------------------------------

/**
 * Builds the full token map for a step by merging suite-level path tokens
 * with any step-local scalar tokens.
 */
export function getStepTokens(
  step: Pick<StepConfig, "tokens">,
): Record<string, string> {
  const tokens = { ...PATH_TOKENS };
  for (const [key, value] of Object.entries(step.tokens ?? {})) {
    tokens[`{${key}}`] = String(value);
  }
  return tokens;
}
