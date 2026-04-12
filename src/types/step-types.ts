import type { existsSync, readFileSync } from "node:fs";
import type { dirname, join } from "node:path";

export interface Command {
  durationMs?: number;
  exitCode: number;
  notFound?: boolean;
  output: string;
  timedOut: boolean;
}

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
  onOutput?: (output: string) => void;
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

export interface LintConfig {
  args: string[];
  concurrencyArgs?: string[];
  concurrencyEnvVar?: string;
  globExtensions: string[];
  maxFiles: number;
  skipDirs: string[];
}

export interface OutputFilter {
  pattern: string;
  type: "stripLines";
}

export interface PostProcessMessage {
  text: string;
  tone?: PostProcessTone;
}

export interface PostProcessSection {
  items: string[];
  title: string;
  tone?: PostProcessTone;
}

export type PostProcessTone = "fail" | "info" | "pass" | "warn";

export interface ProcessedCheck {
  details: string;
  label: string;
  status: "fail" | "pass";
}

export interface StepConfig {
  allowSuiteFlagArgs?: boolean;
  args?: string[];
  cmd?: string;
  config?:
    | InlineTypeScriptConfig<InlineTypeScriptContext, Command>
    | LintConfig
    | Record<string, unknown>;
  enabled?: boolean;
  ensureDirs?: string[];
  failMsg?: string;
  handler?: string;
  key: string;
  label: string;
  outputFilter?: OutputFilter;
  passMsg?: string;
  postProcess?:
    | InlineTypeScriptConfig<
        InlineTypeScriptPostProcessContext,
        StepPostProcessResult
      >
    | Record<string, unknown>;
  preRun?: boolean;
  serialGroup?: string;
  summary?: Summary;
  timeoutDrainMs?: number | string;
  timeoutEnvVar?: string;
  timeoutMs?: number | string;
  tokens?: Record<string, number | string>;
}

export interface StepPostProcessResult {
  extraChecks?: ProcessedCheck[];
  messages?: PostProcessMessage[];
  output?: string;
  sections?: PostProcessSection[];
  status?: "fail" | "pass";
  summary?: string;
}

export type Summary =
  | { default: string; patterns: SummaryPattern[]; type: "pattern" }
  | { type: "simple" };

export interface SummaryPattern {
  cellSep?: string;
  format: string;
  regex: string;
  type: "count" | "literal" | "match" | "table-row";
}
