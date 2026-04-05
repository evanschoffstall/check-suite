import type { CliArguments } from "@/types/index.ts";

import {
  createDirectStepArguments,
  createKeysArguments,
  parseSuiteSelectionArguments,
  resolveDirectStepFromArg,
} from "@/cli/args/selection/index.ts";

const HELP_FLAGS = new Set(["--help", "-h", "help"]);

export function parseCliArguments(argv: string[]): CliArguments {
  const command = argv[2];
  if (isHelpCommand(command) || hasHelpFlag(argv.slice(2))) {
    return createHelpArguments();
  }
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

function createHelpArguments(): CliArguments {
  return {
    command: "help",
    directStep: undefined,
    directStepArgs: [],
    excludedKeys: new Set<string>(),
    invalidOptions: [],
    invalidSuiteExclusions: [],
    invalidSuiteFlags: [],
    keyFilter: null,
    outputMode: "all",
  };
}

function hasHelpFlag(args: string[]): boolean {
  const passthroughSeparatorIndex = args.indexOf("--");
  const parsedArgs =
    passthroughSeparatorIndex >= 0 ? args.slice(0, passthroughSeparatorIndex) : args;
  return parsedArgs.some((arg) => HELP_FLAGS.has(arg));
}

function isHelpCommand(command: string | undefined): boolean {
  return command !== undefined && HELP_FLAGS.has(command);
}
