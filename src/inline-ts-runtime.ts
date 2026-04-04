import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { InlineTypeScriptSource } from "./types.ts";

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

export function compileInlineTypeScriptFunction<TResult>(
  source: string,
): Promise<(context: unknown) => Promise<TResult> | TResult> {
  const cached = INLINE_TS_FUNCTION_CACHE.get(source);
  if (cached) {
    return cached as Promise<(context: unknown) => Promise<TResult> | TResult>;
  }

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

export function resolveInlineTypeScriptRunner<TContext, TResult>(
  source: InlineTypeScriptSource<TContext, TResult>,
): Promise<(context: TContext) => Promise<TResult> | TResult> {
  return typeof source === "function"
    ? Promise.resolve(source)
    : (compileInlineTypeScriptFunction<TResult>(source) as Promise<
        (context: TContext) => Promise<TResult> | TResult
      >);
}
