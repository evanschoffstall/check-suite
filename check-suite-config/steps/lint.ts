import type { StepConfig } from "../../src/types.ts";

/** ESLint validation and autofix step. */
export const lintStep: StepConfig = {
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
    skipDirs: [
      "node_modules",
      ".next",
      "dist",
      "build",
      "coverage",
      ".cache",
    ],
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