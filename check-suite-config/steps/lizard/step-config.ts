import type { StepConfig } from "../../../src/types/index.ts";

export const lizardStep: StepConfig = {
  args: ["check-suite-config/steps/lizard/index.ts"],
  cmd: "bun",
  enabled: true,
  failMsg: "complexity limits exceeded",
  key: "lizard",
  label: "lizard",
  passMsg: "",
  summary: {
    default: "complexity check completed",
    patterns: [
      {
        format: "{1} function violations · {2} file violations",
        regex:
          "complexity:\\s+(\\d+)\\s+function violations\\s+·\\s+(\\d+)\\s+file violations",
        type: "match",
      },
    ],
    type: "pattern",
  },
};
