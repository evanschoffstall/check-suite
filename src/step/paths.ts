import { mkdirSync } from "node:fs";
import { join } from "node:path";

import type { StepConfig } from "../types/index.ts";

import { getStepTokens, resolveTokenString } from "../tokens.ts";

export function ensureStepDirectories(step: StepConfig): void {
  const tokens = getStepTokens(step);
  for (const entry of step.ensureDirs ?? []) {
    mkdirSync(resolveConfiguredPath(resolveTokenString(entry, tokens)), {
      recursive: true,
    });
  }
}

function resolveConfiguredPath(entry: string): string {
  return entry.startsWith("/") ? entry : join(process.cwd(), entry);
}
