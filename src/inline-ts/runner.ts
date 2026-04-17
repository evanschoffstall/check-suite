import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type {
  Command,
  InlineTypeScriptContext,
  InlineTypeScriptOverrides,
  StepConfig,
} from "@/types/index.ts";

import { isRecord } from "@/foundation/index.ts";

import { resolveInlineTypeScriptRunner } from "./compiler";
import { toInlineTypeScriptConfig } from "./config.ts";

export async function runInlineTypeScriptStep(
  step: StepConfig,
  overrides: InlineTypeScriptOverrides = {},
): Promise<Command> {
  const startMs = Date.now();
  throwIfInlineExecutionAborted(overrides.signal);
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
    throwIfInlineExecutionAborted(overrides.signal);
    const runner = await resolveInlineTypeScriptRunner<
      InlineTypeScriptContext,
      Command
    >(inlineConfig.source);
    throwIfInlineExecutionAborted(overrides.signal);
    const durationMs = Date.now() - startMs;
    const result = await runner(
      buildInlineTypeScriptContext(step, inlineConfig.data ?? {}, overrides),
    );
    throwIfInlineExecutionAborted(overrides.signal);
    const command =
      toCommand(result, durationMs) ??
      makeInlineResult(
        1,
        `${step.label} returned an invalid inline TypeScript result\n`,
        durationMs,
      );
    if (!overrides.signal?.aborted) {
      overrides.onOutput?.(command.output);
    }
    return command;
  } catch (error) {
    if (isInlineAbortError(error)) {
      throw error;
    }
    const command = makeInlineResult(
      1,
      `${step.label} failed: ${error instanceof Error ? error.message : String(error)}\n`,
      Date.now() - startMs,
      isInlineMissingDependencyError(error),
    );
    if (!overrides.signal?.aborted) {
      overrides.onOutput?.(command.output);
    }
    return command;
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

  return {
    durationMs:
      typeof value.durationMs === "number"
        ? value.durationMs
        : fallbackDurationMs,
    exitCode: value.exitCode,
    // Preserve an explicit notFound the inline step chose to set, but do not
    // infer it from output text — inline steps are always "found" by definition.
    notFound: value.notFound === true ? true : undefined,
    output: value.output,
    timedOut: value.timedOut,
  };
}

function buildInlineTypeScriptContext(
  step: StepConfig,
  data: Record<string, unknown>,
  overrides: InlineTypeScriptOverrides,
): InlineTypeScriptContext {
  const signal = overrides.signal ?? new AbortController().signal;
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
    signal,
    step: step as unknown as Record<string, unknown>,
    throwIfAborted: () => {
      throwIfInlineExecutionAborted(signal);
    },
  };
}

function createInlineAbortError(): Error {
  const error = new Error("inline TypeScript step aborted");
  error.name = "AbortError";
  return error;
}

function isInlineAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isInlineMissingDependencyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cannot find package ['"][^'"]+['"][^\n]*from ['"][^'"]+[\\/]src[\\/]inline-ts[\\/]runner\.ts['"]/i.test(
    message,
  );
}

// Inline steps are always "found" — they are TypeScript code, not a binary to
// locate. Output text matching hasMissingSignal patterns (e.g. "Cannot find
// module") represents a genuine failure, not a missing tool, so we must NOT
// apply withMissingDetection here.
function makeInlineResult(
  exitCode: number,
  output: string,
  durationMs?: number,
  notFound?: boolean,
): Command {
  return {
    durationMs,
    exitCode,
    notFound: notFound === true ? true : undefined,
    output,
    timedOut: false,
  };
}

function throwIfInlineExecutionAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createInlineAbortError();
  }
}
