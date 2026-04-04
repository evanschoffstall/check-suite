import type { StepConfig } from "../../src/types.ts";

/** Duplicate code detection powered by JSCPD. */
export const jscpdStep: StepConfig = {
  args: ["jscpd", "--config", ".jscpd.json"],
  cmd: "bunx",
  enabled: true,
  failMsg: "duplicates found",
  key: "jscpd",
  label: "jscpd",
  passMsg: "",
  summary: {
    default: "no duplicate stats detected",
    patterns: [
      {
        cellSep: "│",
        format: "{4} clones · {5} lines · {6} tokens · {1} files",
        regex: "│ Total:",
        type: "table-row",
      },
      {
        format: "{1} clones",
        regex: "Found\\s+(\\d+)\\s+clones?",
        type: "match",
      },
    ],
    type: "pattern",
  },
};
