import type { Command, InlineTypeScriptContext } from "@/types/index.ts";

import {
  analyzeArchitecture,
  formatArchitectureViolations,
} from "./analyze";

/** Runs the repository-agnostic architecture analyzer against the current workspace. */
export function architectureStep({
  cwd,
  data,
  fail,
  ok,
}: InlineTypeScriptContext): Command {
  const violations = analyzeArchitecture(cwd, data);
  const output = formatArchitectureViolations(violations);

  return violations.length === 0 ? ok(output) : fail(output);
}
