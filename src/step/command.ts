import type { OutputFilter, StepConfig, Summary } from "@/types/index.ts";

import { type CommandArgsInput, tokenizeCommandArgs } from "./args.ts";

/** Options for constructing a subprocess-backed {@link StepConfig}. */
export interface CommandStepOptions {
  allowSuiteFlagArgs?: boolean;
  args: CommandArgsInput;
  cmd: string;
  enabled?: boolean;
  ensureDirs?: string[];
  failMsg?: string;
  key: string;
  label: string;
  outputFilter?: OutputFilter;
  passMsg?: string;
  postProcess?: StepConfig["postProcess"];
  preRun?: boolean;
  serialGroup?: string;
  summary?: Summary;
  timeoutDrainMs?: number | string;
  timeoutEnvVar?: string;
  timeoutMs?: number | string;
  tokens?: Record<string, number | string>;
}

/**
 * Assembles a command-backed {@link StepConfig} with the platform defaults
 * shared by direct subprocess checks.
 */
export function defineCommandStep(options: CommandStepOptions): StepConfig {
  return {
    allowSuiteFlagArgs: options.allowSuiteFlagArgs,
    args: tokenizeCommandArgs(options.args),
    cmd: options.cmd,
    enabled: options.enabled ?? true,
    ensureDirs: options.ensureDirs,
    failMsg: options.failMsg ?? `${options.label} failed`,
    key: options.key,
    label: options.label,
    outputFilter: options.outputFilter,
    passMsg: options.passMsg ?? "",
    postProcess: options.postProcess,
    preRun: options.preRun,
    serialGroup: options.serialGroup,
    summary: options.summary ?? { type: "simple" },
    timeoutDrainMs: options.timeoutDrainMs,
    timeoutEnvVar: options.timeoutEnvVar,
    timeoutMs: options.timeoutMs,
    tokens: options.tokens,
  };
}
