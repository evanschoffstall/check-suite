import type { StepConfig } from "./step-types.ts";

export interface CheckConfig {
  paths: Record<string, string>;
  steps: StepConfig[];
  suite?: {
    timeoutEnvVar?: string;
    timeoutMs?: number;
  };
}

export interface CliArguments {
  command: "keys" | "run-suite" | "summary";
  directStep?: StepConfig;
  directStepArgs: string[];
  excludedKeys: Set<string>;
  invalidSuiteExclusions: string[];
  invalidSuiteFlags: string[];
  keyFilter: null | Set<string>;
}

export interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}
