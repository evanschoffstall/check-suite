import type { StepConfig } from "../../src/types/index.ts";

/** Package vulnerability audit powered by Bun. */
export const auditStep: StepConfig = {
  args: ["audit"],
  cmd: "bun",
  enabled: true,
  failMsg: "bun audit failed",
  key: "audit",
  label: "audit",
  passMsg: "",
  summary: {
    type: "simple",
  },
};
