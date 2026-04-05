import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { TestCoveragePostProcessOptions } from "@/post-process/index.ts";
import type { StepConfig } from "@/types/index.ts";

import { buildTestCoveragePostProcess } from "@/post-process/index.ts";

/** Options for {@link createTestCoverageStep}. */
export interface TestCoverageStepOptions extends TestCoveragePostProcessOptions {
  allowSuiteFlagArgs?: boolean;
  args: string[];
  cmd: string;
  /** Data passed to the post-processor for runtime token resolution. */
  coverage: {
    excludedFiles?: string[];
    excludedPaths?: string[];
    includedPaths?: string[];
    /** Label shown in the coverage check row. */
    label?: string;
    /** Token string resolving to the LCOV output path, e.g. `"{lcovPath}"`. */
    path?: string;
    /** Token string resolving to the JUnit XML report path, e.g. `"{junitPath}"`. */
    reportPath?: string;
    /**
     * Minimum line-coverage percentage. Accepts a number or a token string.
     * Defaults to {@link TestCoveragePostProcessOptions.defaultThreshold}.
     */
    threshold?: number | string;
  };
  /**
   * If a string, evaluated as a package.json script name: the step is enabled
   * only when that script exists. Defaults to `true`.
   */
  enabled?: boolean | string;
  ensureDirs?: string[];
  failMsg?: string;
  key: string;
  label: string;
  passMsg?: string;
  serialGroup?: string;
  timeoutDrainMs?: number | string;
  timeoutEnvVar?: string;
  timeoutMs?: number | string;
  tokens?: Record<string, number | string>;
}

/**
 * Creates a {@link StepConfig} for a test runner that produces a JUnit XML
 * report and an LCOV coverage file.
 *
 * The post-processor is assembled from {@link buildTestCoveragePostProcess}
 * using the provided coverage options; no step-specific files are needed.
 *
 * @example
 * ```ts
 * // bun unit tests
 * createTestCoverageStep({
 *   cmd: "bun", args: ["test", "--coverage", "--coverage-reporter=lcov"],
 *   key: "junit", label: "junit",
 *   defaultThreshold: 85,
 *   coverage: { path: "{lcovPath}", reportPath: "{junitPath}", includedPaths: ["src"] },
 * });
 *
 * // playwright e2e tests with console coverage
 * createTestCoverageStep({
 *   cmd: "bun", args: ["run", "test:e2e:coverage"],
 *   key: "playwright", label: "playwright",
 *   defaultThreshold: 55,
 *   parseConsoleCoverage: parseBunConsoleCoverage,
 *   coverage: { path: "{playwrightLcovPath}", reportPath: "{playwrightJunitPath}" },
 * });
 * ```
 */
export function createTestCoverageStep(
  options: TestCoverageStepOptions,
): StepConfig {
  const {
    allowSuiteFlagArgs,
    args,
    cmd,
    coverage,
    // post-process options (captured by buildTestCoveragePostProcess)
    defaultThreshold,
    enabled,
    ensureDirs,
    failMsg,
    key,
    label,
    parseConsoleCoverage,
    passMsg,
    serialGroup,
    timeoutDrainMs,
    timeoutEnvVar,
    timeoutMs,
    tokens,
  } = options;

  return {
    ...(allowSuiteFlagArgs !== undefined && { allowSuiteFlagArgs }),
    args,
    cmd,
    enabled: resolveEnabled(enabled),
    ...(ensureDirs !== undefined && { ensureDirs }),
    failMsg: failMsg ?? `${label} failed`,
    key,
    label,
    passMsg: passMsg ?? "",
    postProcess: {
      data: buildCoverageData(coverage, defaultThreshold),
      source: buildTestCoveragePostProcess({
        defaultThreshold,
        parseConsoleCoverage,
      }),
    },
    ...(serialGroup !== undefined && { serialGroup }),
    summary: { type: "simple" },
    ...(timeoutDrainMs !== undefined && { timeoutDrainMs }),
    ...(timeoutEnvVar !== undefined && { timeoutEnvVar }),
    ...(timeoutMs !== undefined && { timeoutMs }),
    ...(tokens !== undefined && { tokens }),
  };
}

function buildCoverageData(
  coverage: TestCoverageStepOptions["coverage"],
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

function hasPackageScript(scriptName: string): boolean {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    return typeof packageJson.scripts?.[scriptName] === "string";
  } catch {
    return false;
  }
}

function resolveEnabled(enabled: TestCoverageStepOptions["enabled"]): boolean {
  if (typeof enabled === "string") {
    return hasPackageScript(enabled);
  }

  return enabled ?? true;
}
