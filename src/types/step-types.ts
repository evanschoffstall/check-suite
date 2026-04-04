import type { Command } from "./command-types.ts";
import type {
  InlineTypeScriptConfig,
  InlineTypeScriptContext,
  InlineTypeScriptPostProcessContext,
} from "./inline-types.ts";
import type { StepPostProcessResult } from "./post-process-types.ts";
import type { OutputFilter, Summary } from "./summary-types.ts";

export interface LintConfig {
  args: string[];
  globExtensions: string[];
  maxFiles: number;
  skipDirs: string[];
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

export type StepRunner = (
  step: StepConfig,
  timeoutMs?: number,
  extraArgs?: string[],
) => Promise<Command>;
