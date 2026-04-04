import type { existsSync, readFileSync } from "node:fs";
import type { dirname, join } from "node:path";

import type { Command } from "./command-types.ts";
import type { StepPostProcessResult } from "./post-process-types.ts";

export interface InlineTypeScriptConfig<TContext, TResult> {
  data?: Record<string, unknown>;
  source: InlineTypeScriptSource<TContext, TResult>;
}

export interface InlineTypeScriptContext {
  cwd: string;
  data: Record<string, unknown>;
  dirname: typeof dirname;
  existsSync: typeof existsSync;
  fail: (output: string, durationMs?: number) => Command;
  importModule: (specifier: string) => Promise<unknown>;
  join: typeof join;
  ok: (output: string, durationMs?: number) => Command;
  readFileSync: typeof readFileSync;
  step: Record<string, unknown>;
}

export interface InlineTypeScriptOverrides {
  importModule?: (specifier: string) => Promise<unknown>;
}

export interface InlineTypeScriptPostProcessContext {
  command: Command;
  cwd: string;
  data: Record<string, unknown>;
  displayOutput: string;
  existsSync: typeof existsSync;
  helpers: {
    compactDomAssertionNoise: (output: string) => string;
    stripAnsi: (v: string) => string;
  };
  join: typeof join;
  readFileSync: typeof readFileSync;
  resolveTokenString: (value: string) => string;
  step: Record<string, unknown>;
  tokens: Record<string, string>;
}

export type InlineTypeScriptPostProcessor = (
  context: InlineTypeScriptPostProcessContext,
) => Promise<StepPostProcessResult> | StepPostProcessResult;

export type InlineTypeScriptSource<TContext, TResult> =
  | ((context: TContext) => Promise<TResult> | TResult)
  | string;
