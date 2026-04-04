import type { StepConfig } from "../../src/types/index.ts";

/** Public typing contract verification powered by tsd. */
export const tsdStep: StepConfig = {
  args: ["tsd", "--typings", "next-env.d.ts", "--files", "next-env.test-d.ts"],
  cmd: "bunx",
  enabled: true,
  failMsg: "tsd failed",
  key: "tsd",
  label: "tsd",
  passMsg: "",
  summary: {
    type: "simple",
  },
};
