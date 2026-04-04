import type { CheckConfig } from "@/types/index.ts";

export {
  lintStep,
  madgeStep,
  tsdStep,
  typeCoverageStep,
  typesStep,
} from "./quality-steps.ts";

/** Package vulnerability audit powered by Bun. */
export const auditStep: CheckConfig["steps"][number] = {
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

/** Source-only secret scanning powered by gitleaks. */
export const gitleaksStep: CheckConfig["steps"][number] = {
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

/** Duplicate code detection powered by JSCPD. */
export const jscpdStep: CheckConfig["steps"][number] = {
  args: ["jscpd", "--config", ".jscpd.json"],
  cmd: "bunx",
  enabled: true,
  failMsg: "duplicates found",
  key: "jscpd",
  label: "jscpd",
  passMsg: "",
  summary: {
    default: "no duplicate stats detected",
    patterns: [
      {
        cellSep: "│",
        format: "{4} clones · {5} lines · {6} tokens · {1} files",
        regex: "│ Total:",
        type: "table-row",
      },
      {
        format: "{1} clones",
        regex: "Found\\s+(\\d+)\\s+clones?",
        type: "match",
      },
    ],
    type: "pattern",
  },
};

/** Dead-code and dependency reachability check powered by Knip. */
export const knipStep: CheckConfig["steps"][number] = {
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

/** Static application security scan powered by Semgrep. */
export const semgrepStep: CheckConfig["steps"][number] = {
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
