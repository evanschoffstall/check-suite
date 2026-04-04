import type { existsSync, readFileSync } from "node:fs";
import type { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Config schema — mirrors the exported check-suite config module structure
// ---------------------------------------------------------------------------

/** Root configuration loaded from the check-suite config module. */
export interface CheckConfig {
  /** Path tokens joined to cwd and exposed as `{key}` substitutions. */
  paths: Record<string, string>;
  steps: StepConfig[];
  /** Suite-level wall-clock timeout — overridable via `timeoutEnvVar`. */
  suite?: {
    timeoutEnvVar?: string;
    timeoutMs?: number;
  };
}

/** Parsed result of CLI argument processing. */
export interface CliArguments {
  command: "keys" | "run-suite" | "summary";
  directStep?: StepConfig;
  directStepArgs: string[];
  excludedKeys: Set<string>;
  invalidSuiteExclusions: string[];
  invalidSuiteFlags: string[];
  keyFilter: null | Set<string>;
}

/** Result returned by a step runner after execution. */
export interface Command {
  durationMs?: number;
  exitCode: number;
  /** True when the command binary was not found or could not be located. */
  notFound?: boolean;
  output: string;
  timedOut: boolean;
}

/** A cancellable promise-based delay handle. */
export interface DelayHandle<T> {
  cancel(): void;
  promise: Promise<T>;
}

/** Inline TypeScript step or post-process configuration. */
export interface InlineTypeScriptConfig<TContext, TResult> {
  data?: Record<string, unknown>;
  source: InlineTypeScriptSource<TContext, TResult>;
}

/** Context object injected into inline TypeScript step handlers. */
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
  step: StepConfig;
}

/** Optional overrides applied when executing an inline TypeScript step. */
export interface InlineTypeScriptOverrides {
  importModule?: (specifier: string) => Promise<unknown>;
}

/** Context object injected into inline TypeScript post-processor handlers. */
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
  step: StepConfig;
  tokens: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Runtime types
// ---------------------------------------------------------------------------

/** Compiled inline TypeScript post-processor function signature. */
export type InlineTypeScriptPostProcessor = (
  context: InlineTypeScriptPostProcessContext,
) => Promise<StepPostProcessResult> | StepPostProcessResult;

/** String or function source accepted by inline TypeScript config entries. */
export type InlineTypeScriptSource<TContext, TResult> =
  | ((context: TContext) => Promise<TResult> | TResult)
  | string;

/** Minimal interface over a spawned child process. */
export interface KillableProcess {
  exited: Promise<null | number>;
  kill(signal?: number | string): void;
}

/** Configuration for the built-in `lint` handler. */
export interface LintConfig {
  args: string[];
  globExtensions: string[];
  maxFiles: number;
  skipDirs: string[];
}

/** Post-execution output filtering rule for a step. */
export interface OutputFilter {
  pattern: string;
  type: "stripLines";
}

/** Subset of package.json used to enumerate declared bunx targets. */
export interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/** A console message emitted by a step post-processor. */
export interface PostProcessMessage {
  text: string;
  tone?: PostProcessTone;
}

/** A labeled list section emitted by a step post-processor. */
export interface PostProcessSection {
  items: string[];
  title: string;
  tone?: PostProcessTone;
}

/** Tone variants used for coloring post-processor output. */
export type PostProcessTone = "fail" | "info" | "pass" | "warn";

/** A single pass/fail check row emitted by a step post-processor. */
export interface ProcessedCheck {
  details: string;
  label: string;
  status: "fail" | "pass";
}

/** Options passed to the low-level subprocess runner. */
export interface RunOptions {
  extraEnv?: Record<string, string>;
  label?: string;
  timeoutDrainMs?: number;
  timeoutMs?: number;
}

/** A single configured check step from the check-suite config module. */
export interface StepConfig {
  /** Allows `bun check --step ...args` to run the selected step directly. */
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
  /** Max drain time for buffered output after a timed-out step is terminated. */
  timeoutDrainMs?: number | string;
  /** Environment variable that overrides `timeoutMs` at runtime. */
  timeoutEnvVar?: string;
  timeoutMs?: number | string;
  /** Step-local scalar token store exposed as `{key}` placeholders. */
  tokens?: Record<string, number | string>;
}

/** Structured result returned by a step post-processor. */
export interface StepPostProcessResult {
  extraChecks?: ProcessedCheck[];
  messages?: PostProcessMessage[];
  output?: string;
  sections?: PostProcessSection[];
  status?: "fail" | "pass";
  summary?: string;
}

/** Function signature for registered step handler implementations. */
export type StepRunner = (
  step: StepConfig,
  timeoutMs?: number,
  extraArgs?: string[],
) => Promise<Command>;

// ---------------------------------------------------------------------------
// Infrastructure types
// ---------------------------------------------------------------------------

/** A stream reader that accumulates output and signals completion. */
export interface StreamCollector {
  done: Promise<void>;
  getOutput: () => string;
}

/** Summary rendering strategy for a step. */
export type Summary =
  | { default: string; patterns: SummaryPattern[]; type: "pattern" }
  | { type: "simple" };

/** One pattern rule within a `pattern`-type summary. */
export interface SummaryPattern {
  cellSep?: string;
  format: string;
  regex: string;
  type: "count" | "literal" | "match" | "table-row";
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/** Returns true when `value` is a non-null object (not an array). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
