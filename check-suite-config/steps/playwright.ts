import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { StepConfig } from "../../src/types.ts";

import { playwrightPostProcess } from "../post-process.ts";

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

/** Playwright end-to-end and coverage step. */
export const playwrightStep: StepConfig = {
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
      coverageExcludedFiles: [],
      coverageExcludedPaths: ["../components/ui"],
      coverageIncludedPaths: ["src"],
      coverageLabel: "playwright-lcov-coverage",
      coveragePath: "{playwrightLcovPath}",
      coverageThreshold: "{lineCoverageThreshold}",
      reportPath: "{playwrightJunitPath}",
    },
    source: playwrightPostProcess,
  },
  serialGroup: "coverage-tests",
  summary: {
    type: "simple",
  },
  timeoutDrainMs: 20000,
  timeoutEnvVar: "CHECK_PLAYWRIGHT_TIMEOUT_MS",
  timeoutMs: 180000,
  tokens: {
    lineCoverageThreshold: 55,
  },
};