import type {
  InlineTypeScriptPostProcessContext,
  StepPostProcessResult,
} from "@/types/index.ts";

import type {
  ConfigCheck,
  ConfigMessage,
  ConfigSection,
} from "../../../types.ts";

import {
  buildCommonCoverageState,
  parseJunitResults,
} from "../../coverage/index.ts";
import { applyCoverageStatus, applyReportStatus } from "./status.ts";

interface BuildJunitResultInput {
  displayOutput: string;
  exitCode: number;
  helpers: InlineTypeScriptPostProcessContext["helpers"];
  state: JunitState;
  status: "fail" | "pass";
}

interface JunitState {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  extraChecks: ConfigCheck[];
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: ConfigMessage[];
  reportExists: boolean;
  sections: ConfigSection[];
}

export function junitPostProcess({
  command,
  data,
  displayOutput,
  existsSync,
  helpers,
  readFileSync,
  resolveTokenString,
}: InlineTypeScriptPostProcessContext): StepPostProcessResult {
  const state = buildJunitState(
    data,
    resolveTokenString,
    displayOutput,
    existsSync,
    readFileSync,
  );
  let status: "fail" | "pass" = command.exitCode === 0 ? "pass" : "fail";
  status = resolveJunitStatus(
    { data, existsSync, readFileSync, resolveTokenString },
    status,
    state,
  );

  return buildJunitResult({
    displayOutput,
    exitCode: command.exitCode,
    helpers,
    state,
    status,
  });
}

function buildJunitResult(input: BuildJunitResultInput): StepPostProcessResult {
  const { displayOutput, exitCode, helpers, state, status } = input;

  return {
    extraChecks: state.extraChecks,
    messages: state.messages,
    output: helpers.compactDomAssertionNoise(displayOutput),
    sections: state.sections,
    status,
    summary: `${state.junitResults.passed} passed · ${state.junitResults.failed} failed · ${state.junitResults.skipped} skipped${exitCode === 0 ? "" : ` · runner exit ${exitCode}`}`,
  };
}

function buildJunitState(
  data: Record<string, unknown>,
  resolveTokenString: InlineTypeScriptPostProcessContext["resolveTokenString"],
  displayOutput: string,
  existsSync: InlineTypeScriptPostProcessContext["existsSync"],
  readFileSync: InlineTypeScriptPostProcessContext["readFileSync"],
): JunitState {
  const coverageState = buildCommonCoverageState(data, resolveTokenString, 85);
  const junitResults = parseJunitResults(
    coverageState.reportPath,
    displayOutput,
    existsSync,
    readFileSync,
  );

  return {
    coverageState,
    extraChecks: [],
    junitResults,
    messages: [],
    reportExists:
      Boolean(coverageState.reportPath) && existsSync(coverageState.reportPath),
    sections: [],
  };
}

function resolveJunitStatus(
  context: Pick<
    InlineTypeScriptPostProcessContext,
    "data" | "existsSync" | "readFileSync" | "resolveTokenString"
  >,
  status: "fail" | "pass",
  state: ReturnType<typeof buildJunitState>,
): "fail" | "pass" {
  const { data, existsSync, readFileSync, resolveTokenString } = context;

  let resolvedStatus = applyReportStatus({
    currentStatus: status,
    failedTests: state.junitResults.failedTests,
    messages: state.messages,
    reportExists: state.reportExists,
    reportPath: state.coverageState.reportPath,
    sections: state.sections,
    skippedTests: state.junitResults.skippedTests,
  });

  resolvedStatus = applyCoverageStatus({
    currentStatus: resolvedStatus,
    data,
    existsSync,
    extraChecks: state.extraChecks,
    messages: state.messages,
    readFileSync,
    resolveTokenString,
  });

  return resolvedStatus;
}
