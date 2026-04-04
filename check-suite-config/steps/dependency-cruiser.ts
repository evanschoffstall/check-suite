import type { StepConfig } from "../../src/types/index.ts";

/** Module dependency rule verification powered by dependency-cruiser. */
export const dependencyCruiserStep: StepConfig = {
  args: ["depcruise", "--no-config", "src", "--output-type", "err"],
  cmd: "bunx",
  enabled: true,
  failMsg: "dependency-cruiser failed",
  key: "dependency-cruiser",
  label: "dependency-cruiser",
  passMsg: "",
  summary: {
    default: "dependency cruise completed",
    patterns: [
      {
        format: "0 dependency violations · {1} modules · {2} dependencies",
        regex:
          "no dependency violations found \\((\\d+) modules, (\\d+) dependencies cruised\\)",
        type: "match",
      },
    ],
    type: "pattern",
  },
};
