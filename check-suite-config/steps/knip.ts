import type { StepConfig } from "../../src/types/index.ts";

/** Dead-code and dependency reachability check powered by Knip. */
export const knipStep: StepConfig = {
  args: ["knip", "--config", "knip.json", "--cache"],
  cmd: "bunx",
  enabled: true,
  failMsg: "knip failed",
  key: "knip",
  label: "knip",
  passMsg: "",
  summary: {
    type: "simple",
  },
};
