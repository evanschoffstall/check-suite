import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  Command,
  InlineTypeScriptPostProcessContext,
  InlineTypeScriptPostProcessor,
  StepConfig,
  StepPostProcessResult,
} from "@/types/index.ts";

import { stripAnsi } from "@/format/index.ts";
import { toInlineTypeScriptConfig } from "@/inline-ts/index.ts";
import { compactDomAssertionNoise } from "@/summary/index.ts";
import { getStepTokens, resolveTokenString } from "@/tokens.ts";

export function buildPostProcessContext(
  step: StepConfig,
  command: Command,
  displayOutput: string,
  data: Record<string, unknown>,
): InlineTypeScriptPostProcessContext {
  const tokens = getStepTokens(step);
  return {
    command,
    cwd: process.cwd(),
    data,
    displayOutput,
    existsSync,
    helpers: {
      compactDomAssertionNoise,
      stripAnsi,
    },
    join,
    readFileSync,
    resolveTokenString: (value) => resolveTokenString(value, tokens),
    step: step as unknown as Record<string, unknown>,
    tokens,
  };
}

export function getRunnablePostProcessConfig(
  step: StepConfig,
  command: Command,
): null | {
  data?: Record<string, unknown>;
  source: InlineTypeScriptPostProcessor | string;
} {
  if (command.notFound || command.timedOut) return null;
  return toInlineTypeScriptConfig<
    InlineTypeScriptPostProcessContext,
    StepPostProcessResult
  >(step.postProcess) as null | {
    data?: Record<string, unknown>;
    source: InlineTypeScriptPostProcessor | string;
  };
}
