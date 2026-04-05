import type { TestCoveragePostProcessOptions } from "@/post-process/index.ts";
import type { StepConfig } from "@/types/index.ts";

import { buildTestCoveragePostProcess } from "@/post-process/index.ts";
import { defineCommandStep } from "@/step/index.ts";

export interface CoverageCommandStepOptions {
  allowSuiteFlagArgs?: boolean;
  args: string[];
  cmd: string;
  coverage: CoverageOptions;
  defaultThreshold: number;
  enabled?: boolean;
  ensureDirs?: string[];
  failMsg?: string;
  key: string;
  label: string;
  parseConsoleCoverage?: TestCoveragePostProcessOptions["parseConsoleCoverage"];
  serialGroup?: string;
  timeoutDrainMs?: number | string;
  timeoutEnvVar?: string;
  timeoutMs?: number | string;
  tokens?: Record<string, number | string>;
}

export interface CoverageOptions {
  excludedFiles?: string[];
  excludedPaths?: string[];
  includedPaths?: string[];
  label?: string;
  path?: string;
  reportPath?: string;
  threshold?: number | string;
}

export function defineCoverageCommandStep(
  input: CoverageCommandStepOptions,
): StepConfig {
  const step = defineCommandStep({
    allowSuiteFlagArgs: input.allowSuiteFlagArgs,
    args: input.args,
    cmd: input.cmd,
    enabled: input.enabled ?? true,
    ensureDirs: input.ensureDirs,
    failMsg: input.failMsg ?? `${input.label} failed`,
    key: input.key,
    label: input.label,
    serialGroup: input.serialGroup,
    timeoutDrainMs: input.timeoutDrainMs,
    timeoutEnvVar: input.timeoutEnvVar,
    timeoutMs: input.timeoutMs,
    tokens: input.tokens,
  });

  step.postProcess = {
    data: buildCoverageData(input.coverage, input.defaultThreshold),
    source: buildTestCoveragePostProcess({
      defaultThreshold: input.defaultThreshold,
      parseConsoleCoverage: input.parseConsoleCoverage,
    }),
  };

  return step;
}

function buildCoverageData(
  coverage: CoverageOptions,
  defaultThreshold: number,
): Record<string, number | string | string[]> {
  return {
    coverageExcludedFiles: coverage.excludedFiles ?? [],
    coverageExcludedPaths: coverage.excludedPaths ?? [],
    coverageIncludedPaths: coverage.includedPaths ?? ["src"],
    coverageLabel: coverage.label ?? "coverage",
    coveragePath: coverage.path ?? "",
    coverageThreshold: coverage.threshold ?? defaultThreshold,
    reportPath: coverage.reportPath ?? "",
  };
}