import type { StepConfig } from "../../src/types.ts";

/** Source-only secret scanning powered by gitleaks. */
export const gitleaksStep: StepConfig = {
  args: [
    "@0xts/gitleaks-cli",
    "detect",
    "-s",
    "src",
    "--no-git",
    "-c",
    ".gitleaks.toml",
  ],
  cmd: "bunx",
  enabled: true,
  failMsg: "gitleaks failed",
  key: "@0xts/gitleaks-cli",
  label: "@0xts/gitleaks-cli",
  passMsg: "",
  summary: {
    type: "simple",
  },
};