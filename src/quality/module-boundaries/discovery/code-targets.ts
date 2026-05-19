import { type CommandArgsInput, tokenizeCommandArgs } from "@/step/index.ts";

export interface CodeTargetDiscoveryOptions {
  extensions: CommandArgsInput;
  ignoredDirectories: CommandArgsInput;
  resolutionEntrypointNames: CommandArgsInput;
  testDirectories: CommandArgsInput;
  testFilePatterns: CommandArgsInput;
}

/**
 * Builds a code-target discovery config from caller-provided extensions and
 * directory lists without hardcoding any repository assumptions.
 */
export function defineCodeTargetDiscovery(
  options: CodeTargetDiscoveryOptions,
): {
  codeTargets: {
    declarationFilePatterns: string[];
    includePatterns: string[];
    resolutionEntrypointNames: string[];
    resolutionExtensions: string[];
    testFilePatterns: string[];
  };
  ignoredDirectories: string[];
  testDirectories: string[];
} {
  const normalizedExtensions = tokenizeCommandArgs(options.extensions).map(
    (extension) => (extension.startsWith(".") ? extension : `.${extension}`),
  );

  return {
    codeTargets: {
      declarationFilePatterns: normalizedExtensions.map(
        (extension) => `**/*.d${extension}`,
      ),
      includePatterns: normalizedExtensions.map(
        (extension) => `**/*${extension}`,
      ),
      resolutionEntrypointNames: tokenizeCommandArgs(
        options.resolutionEntrypointNames,
      ),
      resolutionExtensions: normalizedExtensions,
      testFilePatterns: tokenizeCommandArgs(options.testFilePatterns),
    },
    ignoredDirectories: tokenizeCommandArgs(options.ignoredDirectories),
    testDirectories: tokenizeCommandArgs(options.testDirectories),
  };
}
