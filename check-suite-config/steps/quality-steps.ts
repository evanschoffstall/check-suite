import type { CheckConfig } from "@/types/index.ts";

/** ESLint validation and autofix step. */
export const lintStep: CheckConfig["steps"][number] = {
  config: {
    args: [
      "eslint",
      ".",
      "--cache",
      "--cache-strategy",
      "content",
      "--cache-location",
      ".cache/eslint",
      "--fix",
      "--concurrency",
    ],
    globExtensions: ["js", "mjs", "cjs", "ts", "jsx", "tsx"],
    maxFiles: 5000,
    skipDirs: ["node_modules", ".next", "dist", "build", "coverage", ".cache"],
  },
  enabled: true,
  failMsg: "lint failed",
  handler: "lint",
  key: "lint",
  label: "eslint",
  passMsg: "",
  summary: {
    default: "",
    patterns: [
      {
        format: "{1} problems ({2} errors, {3} warnings)",
        regex:
          "[✖xX]\\s+(\\d+)\\s+problems?\\s*\\((\\d+)\\s+errors?,\\s*(\\d+)\\s+warnings?\\)",
        type: "match",
      },
    ],
    type: "pattern",
  },
};

/** Circular dependency detection powered by Madge. */
export const madgeStep: CheckConfig["steps"][number] = {
  args: ["madge@8", "--circular", "--extensions", "ts,tsx", "src"],
  cmd: "bunx",
  enabled: true,
  failMsg: "circular dependencies found",
  key: "madge",
  label: "madge",
  outputFilter: {
    pattern: "\\b\\d+\\s+warnings?\\b",
    type: "stripLines",
  },
  passMsg: "",
  summary: {
    default: "circular dependency check completed",
    patterns: [
      {
        format: "0 circular dependencies",
        regex: "No circular dependency found",
        type: "literal",
      },
      {
        format: "{1} circular dependencies",
        regex: "Found\\s+(\\d+)\\s+circular\\s+dependenc",
        type: "match",
      },
    ],
    type: "pattern",
  },
};

/** Public typing contract verification powered by tsd. */
export const tsdStep: CheckConfig["steps"][number] = {
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

/** Type-coverage threshold enforcement. */
export const typeCoverageStep: CheckConfig["steps"][number] = {
  args: [
    "type-coverage",
    "--at-least",
    "{typeCoverageThreshold}",
    "--cache",
    "--cache-directory",
    ".cache/type-coverage",
  ],
  cmd: "bunx",
  enabled: true,
  failMsg: "type coverage below threshold",
  key: "type-coverage",
  label: "type-coverage",
  passMsg: "",
  summary: {
    default: "type coverage completed",
    patterns: [
      {
        format: "{3}% ({1}/{2}) · threshold {typeCoverageThreshold}%",
        regex: "\\((\\d+)\\s*/\\s*(\\d+)\\)\\s*([\\d.]+)%",
        type: "match",
      },
    ],
    type: "pattern",
  },
  tokens: {
    typeCoverageThreshold: 98,
  },
};

/** TypeScript compiler verification step. */
export const typesStep: CheckConfig["steps"][number] = {
  args: ["tsc", "--noEmit"],
  cmd: "bunx",
  enabled: true,
  failMsg: "typecheck failed",
  key: "types",
  label: "tsc",
  passMsg: "",
  summary: {
    default: "",
    patterns: [
      {
        format: "{count} TypeScript errors",
        regex: ":\\s+error\\s+TS\\d+:",
        type: "count",
      },
    ],
    type: "pattern",
  },
};
