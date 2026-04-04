import type { StepConfig } from "../../src/types.ts";

/** TypeScript compiler verification step. */
export const typesStep: StepConfig = {
  args: ["tsc", "--noEmit"],
  cmd: "bunx",
  enabled: true,
  failMsg: "typecheck failed",
  key: "types",
  label: "tsc",
  passMsg: "",
  summary: {
    default: "",
    patterns: [
      {
        format: "{count} TypeScript errors",
        regex: ":\\s+error\\s+TS\\d+:",
        type: "count",
      },
    ],
    type: "pattern",
  },
};
