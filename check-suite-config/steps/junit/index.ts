import type { StepConfig } from "@/types/index.ts";

import { junitPostProcess } from "./post-process/index.ts";

/** Bun unit-test and LCOV coverage step. */
export const junitStep: StepConfig = {
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
    data: {
      coverageExcludedFiles: [],
      coverageExcludedPaths: ["../components/ui"],
      coverageIncludedPaths: ["src"],
      coverageLabel: "lcov-coverage",
      coveragePath: "{lcovPath}",
      coverageThreshold: "{lineCoverageThreshold}",
      reportPath: "{junitPath}",
    },
    source: junitPostProcess,
  },
  serialGroup: "coverage-tests",
  summary: {
    type: "simple",
  },
  timeoutEnvVar: "CHECK_TEST_COMMAND_TIMEOUT_MS",
  timeoutMs: 120000,
  tokens: {
    lineCoverageThreshold: 85,
    testTimeoutMs: 5000,
  },
};
