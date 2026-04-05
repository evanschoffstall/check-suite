import type {
  InlineTypeScriptPostProcessContext,
  PostProcessMessage,
  PostProcessSection,
  ProcessedCheck,
  StepPostProcessResult,
} from "@/types/index.ts";

import {
  buildCommonCoverageState,
  buildTestSummary,
  parseJunitResults,
} from "@/steps/coverage/index.ts";

import { applyPlaywrightCoverageStatus } from "./coverage";
import { applyPlaywrightReportStatus } from "./report";

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
  extraChecks: ProcessedCheck[];
  helpers: InlineTypeScriptPostProcessContext["helpers"];
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: PostProcessMessage[];
  sections: PostProcessSection[];
  status: "fail" | "pass";
}): StepPostProcessResult {
  return {
    extraChecks: input.extraChecks,
    messages: input.messages,
    output: input.helpers.compactDomAssertionNoise(input.displayOutput),
    sections: input.sections,
    status: input.status,
    summary: buildTestSummary(input.junitResults, input.exitCode),
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
  extraChecks: ProcessedCheck[];
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: PostProcessMessage[];
  sections: PostProcessSection[];
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
