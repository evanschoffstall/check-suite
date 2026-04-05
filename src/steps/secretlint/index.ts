import type {
  Command,
  InlineTypeScriptContext,
  StepConfig,
} from "@/types/index.ts";

import {
  buildCommand,
  runBufferedCommand,
  runSecretlintBatches,
} from "./command.ts";
import { resolveGitVisibleFiles } from "./git-visible-files.ts";

const NO_VISIBLE_FILES_OUTPUT =
  "No tracked or non-ignored files matched for secretlint\n";
const SECRETLINT_GLOB_ARGS = [
  "secretlint",
  "**/*",
  "--secretlintignore",
  ".secretlintignore",
] as const;

/** Creates a StepConfig for secret scanning powered by Secretlint. */
export function createSecretlintStep(): StepConfig {
  return {
    config: { source: runSecretlintStep },
    enabled: true,
    failMsg: "secretlint failed",
    handler: "inline-ts",
    key: "secretlint",
    label: "secretlint",
    passMsg: "",
    summary: { type: "simple" },
  };
}

function runSecretlintStep({ cwd }: InlineTypeScriptContext): Command {
  const startedAt = Date.now();
  const gitVisibleFiles = resolveGitVisibleFiles(cwd);

  if (gitVisibleFiles.kind === "failure") {
    return buildCommand(
      gitVisibleFiles.exitCode,
      gitVisibleFiles.output,
      startedAt,
    );
  }

  if (gitVisibleFiles.kind === "fallback") {
    const result = runBufferedCommand(cwd, "bunx", [...SECRETLINT_GLOB_ARGS]);
    return buildCommand(result.exitCode, result.output, startedAt);
  }

  if (gitVisibleFiles.paths.length === 0) {
    return buildCommand(0, NO_VISIBLE_FILES_OUTPUT, startedAt);
  }

  return runSecretlintBatches(cwd, gitVisibleFiles.paths, startedAt);
}
