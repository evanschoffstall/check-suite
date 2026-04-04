import type {
  InlineTypeScriptPostProcessContext,
  StepPostProcessResult,
} from "../../../../src/types/index.ts";

import { applyCoverageStatus } from "./coverage-check.ts";
import { applyReportStatus } from "./report-status.ts";
import { buildJunitResult } from "./result.ts";
import { buildJunitState } from "./state.ts";

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

function resolveJunitStatus(
  context: Pick<
    InlineTypeScriptPostProcessContext,
    "data" | "existsSync" | "readFileSync" | "resolveTokenString"
  >,
  status: "fail" | "pass",
  state: ReturnType<typeof buildJunitState>,
): "fail" | "pass" {
  const { data, existsSync, readFileSync, resolveTokenString } = context;

  let resolvedStatus = applyReportStatus(
    state.reportExists,
    state.coverageState.reportPath,
    state.junitResults.failedTests,
    state.junitResults.skippedTests,
    state.messages,
    state.sections,
    status,
  );

  resolvedStatus = applyCoverageStatus(
    data,
    resolveTokenString,
    existsSync,
    readFileSync,
    state.messages,
    state.extraChecks,
    resolvedStatus,
  );

  return resolvedStatus;
}
