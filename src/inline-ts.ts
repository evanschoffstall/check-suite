import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import type {
  Command,
  InlineTypeScriptConfig,
  InlineTypeScriptContext,
  InlineTypeScriptOverrides,
  InlineTypeScriptSource,
  StepConfig,
} from "./types.ts";

import { withMissingDetection } from "./process.ts";
import { isRecord } from "./types.ts";

// ---------------------------------------------------------------------------
// Inline TypeScript compilation cache
// ---------------------------------------------------------------------------

const INLINE_TS_FUNCTION_CACHE = new Map<
  string,
  Promise<(context: unknown) => unknown>
>();

const INLINE_TS_TRANSPILE = new Bun.Transpiler({ loader: "ts" });
const INLINE_TS_CACHE_DIR = join(
  process.cwd(),
  ".cache",
  "check-suite",
  "inline-ts",
);

// ---------------------------------------------------------------------------
// Config coercers
// ---------------------------------------------------------------------------

/**
 * Transpiles and caches an anonymous inline TypeScript function.
 * The source must evaluate to a single anonymous function expression.
 */
export function compileInlineTypeScriptFunction<TResult>(
  source: string,
): Promise<(context: unknown) => Promise<TResult> | TResult> {
  const cached = INLINE_TS_FUNCTION_CACHE.get(source);
  if (cached)
    return cached as Promise<(context: unknown) => Promise<TResult> | TResult>;

  const runnerPromise = (async () => {
    const jsSource = INLINE_TS_TRANSPILE.transformSync(
      `const __runner = (${source});\nexport default __runner;`,
    );
    const modulePath = join(
      INLINE_TS_CACHE_DIR,
      `${Bun.hash(source).toString(16)}.mjs`,
    );
    mkdirSync(INLINE_TS_CACHE_DIR, { recursive: true });
    writeFileSync(modulePath, jsSource);

    const inlineModule = (await import(pathToFileURL(modulePath).href)) as {
      default?: unknown;
    };
    const runner = inlineModule.default;
    if (typeof runner !== "function") {
      throw new Error(
        "inline TypeScript config must evaluate to an anonymous function",
      );
    }

    return runner as (context: unknown) => unknown;
  })();

  INLINE_TS_FUNCTION_CACHE.set(source, runnerPromise);
  return runnerPromise as Promise<
    (context: unknown) => Promise<TResult> | TResult
  >;
}

/**
 * Resolves an inline TypeScript source string or function to an executable runner.
 */
export function resolveInlineTypeScriptRunner<TContext, TResult>(
  source: InlineTypeScriptSource<TContext, TResult>,
): Promise<(context: TContext) => Promise<TResult> | TResult> {
  if (typeof source === "function") {
    return Promise.resolve(source);
  }

  return compileInlineTypeScriptFunction<TResult>(source) as Promise<
    (context: TContext) => Promise<TResult> | TResult
  >;
}

/**
 * Executes the inline TypeScript `source` from a step's config, injecting a
 * sandboxed context with filesystem helpers and pass/fail result builders.
 */
export async function runInlineTypeScriptStep(
  step: StepConfig,
  overrides: InlineTypeScriptOverrides = {},
): Promise<Command> {
  const startMs = Date.now();
  const inlineConfig = toInlineTypeScriptConfig<
    InlineTypeScriptContext,
    Command
  >(step.config);
  if (!inlineConfig)
    return withMissingDetection({
      durationMs: Date.now() - startMs,
      exitCode: 1,
      output: `${step.label} is missing a valid inline TypeScript config\n`,
      timedOut: false,
    });

  const makeResult = (exitCode: number, output: string, durationMs?: number) =>
    withMissingDetection({ durationMs, exitCode, output, timedOut: false });

  try {
    const runner = await resolveInlineTypeScriptRunner<
      InlineTypeScriptContext,
      Command
    >(
      inlineConfig.source,
    );
    const context: InlineTypeScriptContext = {
      cwd: process.cwd(),
      data: inlineConfig.data ?? {},
      dirname,
      existsSync,
      fail: (output, durationMs) => makeResult(1, output, durationMs),
      importModule:
        overrides.importModule ?? ((specifier) => import(specifier)),
      join,
      ok: (output, durationMs) => makeResult(0, output, durationMs),
      readFileSync,
      step,
    };

    const result = await runner(context);

    const durationMs = Date.now() - startMs;
    return (
      toCommand(result, durationMs) ??
      makeResult(
        1,
        `${step.label} returned an invalid inline TypeScript result\n`,
        durationMs,
      )
    );
  } catch (e) {
    return makeResult(
      1,
      `${step.label} failed: ${e instanceof Error ? e.message : String(e)}\n`,
      Date.now() - startMs,
    );
  }
}

// ---------------------------------------------------------------------------
// Inline TypeScript compiler
// ---------------------------------------------------------------------------

/**
 * Converts an unknown value to a typed `Command` result, validating required fields.
 * Returns `null` when the value does not satisfy the `Command` contract.
 */
export function toCommand(
  value: unknown,
  fallbackDurationMs: number,
): Command | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.exitCode !== "number" ||
    typeof value.timedOut !== "boolean" ||
    typeof value.output !== "string"
  )
    return null;
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

// ---------------------------------------------------------------------------
// Inline TypeScript step runner
// ---------------------------------------------------------------------------

/** Extracts and validates an `InlineTypeScriptConfig` from a raw step config value. */
export function toInlineTypeScriptConfig(
  config: StepConfig["config"] | StepConfig["postProcess"],
): InlineTypeScriptConfig<unknown, unknown> | null;
export function toInlineTypeScriptConfig<TContext, TResult>(
  config: StepConfig["config"] | StepConfig["postProcess"],
): InlineTypeScriptConfig<TContext, TResult> | null;
export function toInlineTypeScriptConfig<TContext, TResult>(
  config: StepConfig["config"] | StepConfig["postProcess"],
): InlineTypeScriptConfig<TContext, TResult> | null {
  if (!isRecord(config)) return null;
  const source = config.source;
  const data = config.data;
  if (typeof source !== "string" && typeof source !== "function") {
    return null;
  }
  return {
    data: isRecord(data) ? data : {},
    source: source as InlineTypeScriptSource<TContext, TResult>,
  };
}
