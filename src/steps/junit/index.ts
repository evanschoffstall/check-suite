import type { StepConfig } from "@/types/index.ts";

import { junitPostProcess } from "@/steps/junit/post-process/index.ts";

/** Configurable data for the JUnit / Bun test step. */
export interface JunitStepData {
  /** Files to exclude from coverage by exact normalized path. */
  coverageExcludedFiles?: string[];
  /** Directory prefixes to exclude from coverage. */
  coverageExcludedPaths?: string[];
  /** Directory prefixes to include in coverage. */
  coverageIncludedPaths?: string[];
  /** Label shown in the coverage check row. */
  coverageLabel?: string;
  /** Token string resolving to the LCOV output path. */
  coveragePath?: string;
  /** Minimum line-coverage percentage threshold. */
  coverageThreshold?: number | string;
  /** Token string resolving to the JUnit XML report path. */
  reportPath?: string;
  /** Per-test timeout in milliseconds. */
  testTimeoutMs?: number;
}

/** Creates a StepConfig for Bun unit tests with LCOV coverage. */
export function createJunitStep(data: JunitStepData): StepConfig {
  const postProcessData = buildJunitPostProcessData(data);

  return {
    allowSuiteFlagArgs: true,
    args: [
      "test",
      "--timeout={testTimeoutMs}",
      "--coverage",
      "--coverage-reporter=lcov",
      "--coverage-dir=coverage",
      "--reporter=junit",
      "--reporter-outfile={junitPath}",
    ],
    cmd: "bun",
    enabled: true,
    ensureDirs: ["coverage"],
    failMsg: "",
    key: "junit",
    label: "junit",
    passMsg: "",
    postProcess: {
      data: postProcessData,
      source: junitPostProcess,
    },
    serialGroup: "coverage-tests",
    summary: { type: "simple" },
    timeoutEnvVar: "CHECK_TEST_COMMAND_TIMEOUT_MS",
    timeoutMs: 120000,
    tokens: {
      lineCoverageThreshold: 85,
      testTimeoutMs: resolveTestTimeoutMs(data),
    },
  };
}

function buildJunitPostProcessData(data: JunitStepData): {
  coverageExcludedFiles: string[];
  coverageExcludedPaths: string[];
  coverageIncludedPaths: string[];
  coverageLabel: string;
  coveragePath: number | string;
  coverageThreshold: number | string;
  reportPath: string;
} {
  return {
    coverageExcludedFiles: data.coverageExcludedFiles ?? [],
    coverageExcludedPaths: data.coverageExcludedPaths ?? [],
    coverageIncludedPaths: data.coverageIncludedPaths ?? ["src"],
    coverageLabel: data.coverageLabel ?? "lcov-coverage",
    coveragePath: data.coveragePath ?? "{lcovPath}",
    coverageThreshold: data.coverageThreshold ?? "{lineCoverageThreshold}",
    reportPath: data.reportPath ?? "{junitPath}",
  };
}

function resolveTestTimeoutMs(data: JunitStepData): number {
  return data.testTimeoutMs ?? 5000;
}
