import type {
  InlineTypeScriptPostProcessContext,
  StepPostProcessResult,
} from "@/types/index.ts";

import type { ConfigCheck, ConfigMessage, ConfigSection } from "../../types.ts";

import {
  buildCommonCoverageState,
  parseJunitResults,
} from "../coverage/index.ts";
import { applyPlaywrightCoverageStatus } from "./post-process-coverage.ts";
import { applyPlaywrightReportStatus } from "./post-process-report.ts";

/**
 * Post-processes the Playwright step by using console coverage totals when
 * available and falling back to LCOV totals when path filters are active or the
 * summary row is missing.
 */
export function playwrightPostProcess({
  command,
  data,
  displayOutput,
  existsSync,
  helpers,
  readFileSync,
  resolveTokenString,
}: InlineTypeScriptPostProcessContext): StepPostProcessResult {
  const state = createPlaywrightState(
    data,
    displayOutput,
    existsSync,
    readFileSync,
    resolveTokenString,
  );
  const status = resolvePlaywrightStatus(
    state,
    command.exitCode === 0 ? "pass" : "fail",
    displayOutput,
    existsSync,
    readFileSync,
  );

  return buildPlaywrightResult({
    displayOutput,
    exitCode: command.exitCode,
    extraChecks: state.extraChecks,
    helpers,
    junitResults: state.junitResults,
    messages: state.messages,
    sections: state.sections,
    status,
  });
}

function buildPlaywrightResult(input: {
  displayOutput: string;
  exitCode: number;
  extraChecks: ConfigCheck[];
  helpers: InlineTypeScriptPostProcessContext["helpers"];
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: ConfigMessage[];
  sections: ConfigSection[];
  status: "fail" | "pass";
}): StepPostProcessResult {
  return {
    extraChecks: input.extraChecks,
    messages: input.messages,
    output: input.helpers.compactDomAssertionNoise(input.displayOutput),
    sections: input.sections,
    status: input.status,
    summary: `${input.junitResults.passed} passed · ${input.junitResults.failed} failed · ${input.junitResults.skipped} skipped${input.exitCode === 0 ? "" : ` · runner exit ${input.exitCode}`}`,
  };
}

function createPlaywrightState(
  data: Record<string, unknown>,
  displayOutput: string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
  resolveTokenString: (value: string) => string,
): {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  extraChecks: ConfigCheck[];
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: ConfigMessage[];
  sections: ConfigSection[];
} {
  const coverageState = buildCommonCoverageState(data, resolveTokenString, 0);

  return {
    coverageState,
    extraChecks: [],
    junitResults: parseJunitResults(
      coverageState.reportPath,
      displayOutput,
      existsSync,
      readFileSync,
    ),
    messages: [],
    sections: [],
  };
}

function resolvePlaywrightStatus(
  state: ReturnType<typeof createPlaywrightState>,
  initialStatus: "fail" | "pass",
  displayOutput: string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
): "fail" | "pass" {
  const reportStatus = applyPlaywrightReportStatus({
    coverageState: state.coverageState,
    existsSync,
    junitResults: state.junitResults,
    messages: state.messages,
    sections: state.sections,
    status: initialStatus,
  });

  return applyPlaywrightCoverageStatus({
    coverageState: state.coverageState,
    displayOutput,
    existsSync,
    extraChecks: state.extraChecks,
    messages: state.messages,
    readFileSync,
    status: reportStatus,
  });
}
