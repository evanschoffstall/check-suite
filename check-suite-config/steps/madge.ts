import type { StepConfig } from "../../src/types/index.ts";

/** Circular dependency detection powered by Madge. */
export const madgeStep: StepConfig = {
  args: ["madge@8", "--circular", "--extensions", "ts,tsx", "src"],
  cmd: "bunx",
  enabled: true,
  failMsg: "circular dependencies found",
  key: "madge",
  label: "madge",
  outputFilter: {
    pattern: "\\b\\d+\\s+warnings?\\b",
    type: "stripLines",
  },
  passMsg: "",
  summary: {
    default: "circular dependency check completed",
    patterns: [
      {
        format: "0 circular dependencies",
        regex: "No circular dependency found",
        type: "literal",
      },
      {
        format: "{1} circular dependencies",
        regex: "Found\\s+(\\d+)\\s+circular\\s+dependenc",
        type: "match",
      },
    ],
    type: "pattern",
  },
};
