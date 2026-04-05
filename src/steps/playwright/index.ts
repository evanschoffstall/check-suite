import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { StepConfig } from "@/types/index.ts";

import { playwrightPostProcess } from "@/steps/playwright/post-process/index.ts";

/** Configurable data for the Playwright e2e step. */
export interface PlaywrightStepData {
  /** Files to exclude from coverage by exact normalized path. */
  coverageExcludedFiles?: string[];
  /** Directory prefixes to exclude from coverage. */
  coverageExcludedPaths?: string[];
  /** Directory prefixes to include in coverage. */
  coverageIncludedPaths?: string[];
  /** Label shown in the coverage check row. */
  coverageLabel?: string;
  /** Token string resolving to the Playwright LCOV output path. */
  coveragePath?: string;
  /** Minimum line-coverage percentage threshold. */
  coverageThreshold?: number | string;
  /** Token string resolving to the Playwright JUnit XML report path. */
  reportPath?: string;
}

/** Creates a StepConfig for Playwright end-to-end tests with coverage. */
export function createPlaywrightStep(data: PlaywrightStepData): StepConfig {
  return {
    args: ["run", "test:e2e:coverage"],
    cmd: "bun",
    enabled: hasPackageScript("test:e2e:coverage"),
    ensureDirs: ["coverage/playwright"],
    failMsg: "playwright e2e failed",
    key: "playwright",
    label: "playwright",
    passMsg: "",
    postProcess: {
      data: {
        coverageExcludedFiles: data.coverageExcludedFiles ?? [],
        coverageExcludedPaths: data.coverageExcludedPaths ?? [],
        coverageIncludedPaths: data.coverageIncludedPaths ?? ["src"],
        coverageLabel: data.coverageLabel ?? "playwright-lcov-coverage",
        coveragePath: data.coveragePath ?? "{playwrightLcovPath}",
        coverageThreshold: data.coverageThreshold ?? "{lineCoverageThreshold}",
        reportPath: data.reportPath ?? "{playwrightJunitPath}",
      },
      source: playwrightPostProcess,
    },
    serialGroup: "coverage-tests",
    summary: { type: "simple" },
    timeoutDrainMs: 20000,
    timeoutEnvVar: "CHECK_PLAYWRIGHT_TIMEOUT_MS",
    timeoutMs: 180000,
    tokens: {
      lineCoverageThreshold: 55,
    },
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
