import type {
  Command,
  StepConfig,
  StepPostProcessResult,
} from "./step-runtime-types.ts";

export interface CheckConfig {
  paths: Record<string, string>;
  steps: StepConfig[];
  suite?: {
    timeoutEnvVar?: string;
    timeoutMs?: number;
  };
}

/** A single entry in the flat {@link defineCheckSuiteConfig} array. */
export type CheckConfigEntry = PathsConfigEntry | StepConfig | SuiteConfigEntry;

export interface CheckRow {
  details: string;
  durationMs?: number;
  label: string;
  status: "fail" | "pass";
  stepKey: null | string;
}

export interface CliArguments {
  command: "help" | "keys" | "run-suite" | "summary";
  directStep?: StepConfig;
  directStepArgs: string[];
  excludedKeys: Set<string>;
  invalidOptions: string[];
  invalidSuiteExclusions: string[];
  invalidSuiteFlags: string[];
  keyFilter: null | Set<string>;
  outputMode: SuiteOutputMode;
}

export interface DelayHandle<T> {
  cancel(): void;
  promise: Promise<T>;
}

export interface KillableProcess {
  exited: Promise<null | number>;
  kill(signal?: number | string): void;
}

export interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

/** A path-token map entry in the flat {@link defineCheckSuiteConfig} array. */
export interface PathsConfigEntry {
  paths: Record<string, string>;
}

export interface ProcessedResultEntry {
  displayOutput: string;
  postProcess: null | StepPostProcessResult;
}

export interface RunOptions {
  extraEnv?: Record<string, string>;
  label?: string;
  timeoutDrainMs?: number;
  timeoutMs?: number;
}

export interface StreamCollector {
  done: Promise<void>;
  getOutput: () => string;
}

/** A suite-level configuration entry in the flat {@link defineCheckSuiteConfig} array. */
export interface SuiteConfigEntry {
  suite: NonNullable<CheckConfig["suite"]>;
}

export interface SuiteExecutionState {
  allExecutedSteps: StepConfig[];
  executedMainSteps: StepConfig[];
  runs: Record<string, Command>;
  suiteExpiredBeforeOutput: boolean;
  timedOut: boolean;
}

export type SuiteOutputMode = "all" | "failures-only";

export type {
  Command,
  InlineTypeScriptConfig,
  InlineTypeScriptContext,
  InlineTypeScriptOverrides,
  InlineTypeScriptPostProcessContext,
  InlineTypeScriptPostProcessor,
  InlineTypeScriptSource,
  LintConfig,
  OutputFilter,
  PostProcessMessage,
  PostProcessSection,
  PostProcessTone,
  ProcessedCheck,
  StepConfig,
  StepPostProcessResult,
  Summary,
  SummaryPattern,
} from "./step-runtime-types.ts";
