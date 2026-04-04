import type { StepConfig } from "../../src/types.ts";

/** Static application security scan powered by Semgrep. */
export const semgrepStep: StepConfig = {
  args: [
    "scan",
    "--config",
    "p/default",
    "--error",
    "--metrics",
    "off",
    "--exclude=tests",
    "--exclude=src/components/ui",
    "--exclude-rule=javascript.lang.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml",
    "--exclude-rule=typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml",
    "--exclude-rule=problem-based-packs.insecure-transport.js-node.bypass-tls-verification.bypass-tls-verification",
    "--quiet",
    "src",
  ],
  cmd: "semgrep",
  enabled: true,
  failMsg: "semgrep failed",
  key: "semgrep",
  label: "semgrep",
  passMsg: "",
  summary: {
    type: "simple",
  },
};