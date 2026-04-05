import type { StepConfig } from "@/types/index.ts";

import type { LizardConfig } from "./main.ts";

/** Creates a StepConfig that runs the lizard complexity analysis as a subprocess. */
export function createLizardStep(config: LizardConfig): StepConfig {
  return {
    args: ["src/steps/lizard/index.ts", `--config=${JSON.stringify(config)}`],
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
}
