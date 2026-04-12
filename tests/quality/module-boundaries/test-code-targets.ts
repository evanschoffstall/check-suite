import type {
  ArchitectureAnalyzerConfig,
  ArchitectureCodeTargetsConfig,
} from "@/quality/module-boundaries/foundation/index.ts";

export const TEST_CODE_TARGETS: ArchitectureCodeTargetsConfig = {
  declarationFilePatterns: [
    "**/*.d.cjs",
    "**/*.d.js",
    "**/*.d.jsx",
    "**/*.d.mjs",
    "**/*.d.ts",
    "**/*.d.tsx",
  ],
  includePatterns: [
    "**/*.cjs",
    "**/*.js",
    "**/*.jsx",
    "**/*.mjs",
    "**/*.ts",
    "**/*.tsx",
  ],
  resolutionEntrypointNames: ["index", "main", "mod"],
  resolutionExtensions: [".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"],
  testFilePatterns: ["**/*.spec.*", "**/*.test.*"],
};

/** Applies the TS/JS fixture code-target contract used by the architecture tests. */
export function withTestCodeTargets(
  config: Partial<ArchitectureAnalyzerConfig>,
): ArchitectureAnalyzerConfig {
  return {
    ...config,
    codeTargets: {
      ...TEST_CODE_TARGETS,
      ...(config.codeTargets ?? {}),
    },
  };
}