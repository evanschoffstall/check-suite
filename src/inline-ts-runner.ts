import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  Command,
  InlineTypeScriptContext,
  InlineTypeScriptOverrides,
  StepConfig,
} from "./types.ts";

import { toInlineTypeScriptConfig } from "./inline-ts-config.ts";
import { resolveInlineTypeScriptRunner } from "./inline-ts-runtime.ts";
import { withMissingDetection } from "./process.ts";
import { isRecord } from "./types.ts";

export async function runInlineTypeScriptStep(
  step: StepConfig,
  overrides: InlineTypeScriptOverrides = {},
): Promise<Command> {
  const startMs = Date.now();
  const inlineConfig = toInlineTypeScriptConfig<
    InlineTypeScriptContext,
    Command
  >(step.config);
  if (!inlineConfig) {
    return makeInlineResult(
      1,
      `${step.label} is missing a valid inline TypeScript config\n`,
      Date.now() - startMs,
    );
  }

  try {
    const runner = await resolveInlineTypeScriptRunner<
      InlineTypeScriptContext,
      Command
    >(inlineConfig.source);
    const durationMs = Date.now() - startMs;
    const result = await runner(
      buildInlineTypeScriptContext(step, inlineConfig.data ?? {}, overrides),
    );
    return (
      toCommand(result, durationMs) ??
      makeInlineResult(
        1,
        `${step.label} returned an invalid inline TypeScript result\n`,
        durationMs,
      )
    );
  } catch (error) {
    return makeInlineResult(
      1,
      `${step.label} failed: ${error instanceof Error ? error.message : String(error)}\n`,
      Date.now() - startMs,
    );
  }
}

export function toCommand(
  value: unknown,
  fallbackDurationMs: number,
): Command | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.exitCode !== "number" ||
    typeof value.timedOut !== "boolean" ||
    typeof value.output !== "string"
  ) {
    return null;
  }

  return withMissingDetection({
    durationMs:
      typeof value.durationMs === "number"
        ? value.durationMs
        : fallbackDurationMs,
    exitCode: value.exitCode,
    notFound: value.notFound === true ? true : undefined,
    output: value.output,
    timedOut: value.timedOut,
  });
}

function buildInlineTypeScriptContext(
  step: StepConfig,
  data: Record<string, unknown>,
  overrides: InlineTypeScriptOverrides,
): InlineTypeScriptContext {
  return {
    cwd: process.cwd(),
    data,
    dirname,
    existsSync,
    fail: (output, durationMs) => makeInlineResult(1, output, durationMs),
    importModule: overrides.importModule ?? ((specifier) => import(specifier)),
    join,
    ok: (output, durationMs) => makeInlineResult(0, output, durationMs),
    readFileSync,
    step,
  };
}

function makeInlineResult(
  exitCode: number,
  output: string,
  durationMs?: number,
): Command {
  return withMissingDetection({
    durationMs,
    exitCode,
    output,
    timedOut: false,
  });
}
