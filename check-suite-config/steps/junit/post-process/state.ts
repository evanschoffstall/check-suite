import type { InlineTypeScriptPostProcessContext } from "../../../../src/types/index.ts";
import type {
  ConfigCheck,
  ConfigMessage,
  ConfigSection,
} from "../../../types.ts";

import {
  buildCommonCoverageState,
  parseJunitResults,
} from "../../coverage/index.ts";

/**
 * Aggregates mutable state used while evaluating JUnit-derived post-process data.
 */
export interface JunitState {
  coverageState: ReturnType<typeof buildCommonCoverageState>;
  extraChecks: ConfigCheck[];
  junitResults: ReturnType<typeof parseJunitResults>;
  messages: ConfigMessage[];
  reportExists: boolean;
  sections: ConfigSection[];
}

/**
 * Builds initial state for JUnit post-processing from command output and config.
 */
export function buildJunitState(
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
