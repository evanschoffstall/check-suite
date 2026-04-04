import type {
  InlineTypeScriptPostProcessContext,
  StepPostProcessResult,
} from "../../../../src/types/index.ts";
import type { JunitState } from "./state.ts";

import { formatJunitSummary } from "./summary.ts";

interface BuildJunitResultInput {
  displayOutput: string;
  exitCode: number;
  helpers: InlineTypeScriptPostProcessContext["helpers"];
  state: JunitState;
  status: "fail" | "pass";
}

export function buildJunitResult(
  input: BuildJunitResultInput,
): StepPostProcessResult {
  const { displayOutput, exitCode, helpers, state, status } = input;

  return {
    extraChecks: state.extraChecks,
    messages: state.messages,
    output: helpers.compactDomAssertionNoise(displayOutput),
    sections: state.sections,
    status,
    summary: formatJunitSummary(
      state.junitResults.passed,
      state.junitResults.failed,
      state.junitResults.skipped,
      exitCode,
    ),
  };
}
