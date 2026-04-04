import type { StepConfig } from "../../src/types.ts";

/** Secret scanning powered by Secretlint. */
export const secretlintStep: StepConfig = {
  args: ["secretlint", "**/*", "--secretlintignore", ".secretlintignore"],
  cmd: "bunx",
  enabled: true,
  failMsg: "secretlint failed",
  key: "secretlint",
  label: "secretlint",
  passMsg: "",
  summary: {
    type: "simple",
  },
};
