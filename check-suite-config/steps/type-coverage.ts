import type { StepConfig } from "../../src/types.ts";

/** Type-coverage threshold enforcement. */
export const typeCoverageStep: StepConfig = {
  args: [
    "type-coverage",
    "--at-least",
    "{typeCoverageThreshold}",
    "--cache",
    "--cache-directory",
    ".cache/type-coverage",
  ],
  cmd: "bunx",
  enabled: true,
  failMsg: "type coverage below threshold",
  key: "type-coverage",
  label: "type-coverage",
  passMsg: "",
  summary: {
    default: "type coverage completed",
    patterns: [
      {
        format: "{3}% ({1}/{2}) · threshold {typeCoverageThreshold}%",
        regex: "\\((\\d+)\\s*\\/\\s*(\\d+)\\)\\s*([\\d.]+)%",
        type: "match",
      },
    ],
    type: "pattern",
  },
  tokens: {
    typeCoverageThreshold: 98,
  },
};