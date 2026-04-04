import type { CliArguments } from "../types/index.ts";

import {
  createDirectStepArguments,
  createKeysArguments,
  resolveDirectStepFromArg,
} from "./args-direct.ts";
import { parseSuiteSelectionArguments } from "./args-selection.ts";

export function parseCliArguments(argv: string[]): CliArguments {
  const command = argv[2];
  if (command === "keys") return createKeysArguments();

  const isSummaryCommand = command === "summary";
  const suiteCommand: CliArguments["command"] = isSummaryCommand
    ? "summary"
    : "run-suite";
  const suiteArgStartIndex = isSummaryCommand ? 3 : 2;
  const directStep = resolveDirectStepFromArg(
    argv,
    isSummaryCommand,
    suiteArgStartIndex,
  );
  if (directStep) {
    return createDirectStepArguments(
      suiteCommand,
      directStep,
      argv.slice(suiteArgStartIndex + 1),
    );
  }

  return parseSuiteSelectionArguments(argv, suiteArgStartIndex, suiteCommand);
}
