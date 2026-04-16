import type { CheckingIndicatorController } from "@/suite-processing/checking-indicator/index.ts";

import { startCheckingIndicator } from "@/suite-processing/checking-indicator/index.ts";

const HELP_FLAGS = new Set(["--help", "-h", "help"]);
const HELP_TEXT = [
  "Usage: check-suite [command] [options]",
  "",
  "Commands:",
  "  keys                 List enabled step keys",
  "  summary [flags]      Run the suite without detailed step output",
  "  <step-key> [args]    Run a single step directly",
  "  help                 Show this help text",
  "",
  "Suite Options:",
  "  --output=failures    Show detailed output only for failing steps (default)",
  "  --output=all         Show detailed output for all steps",
  "  --format=plain      Disable ANSI styling, animation, and decorative glyphs",
  "  --format=styled     Use the default styled terminal renderer",
  "  --fail-lines=<n>     Show only the first <n> lines of each failing step output",
  "  ---no=<step-key>     Exclude a suite step",
  "  --<step-key>         Run only the named suite step(s)",
  "  --help, -h           Show this help text",
  "",
  "Examples:",
  "  check-suite",
  "  check-suite --output=all",
  "  check-suite --format=plain",
  "  check-suite --fail-lines=25",
  "  check-suite summary --<step-key>",
  "  check-suite <step-key> -- --watch",
].join("\n");

// ---------------------------------------------------------------------------
// Output helper
// ---------------------------------------------------------------------------

/** Parses CLI arguments and dispatches to the appropriate runner. */
export async function main(): Promise<void> {
  const argv = Bun.argv;
  if (isHelpRequest(argv)) {
    writeOut(HELP_TEXT);
    return;
  }
  const cliArguments = await loadCliArguments(argv);

  if (cliArguments.command === "help") {
    writeOut(HELP_TEXT);
    return;
  }

  const indicator = shouldShowCheckingIndicator(cliArguments)
    ? startCheckingIndicator({
        displayMode: cliArguments.renderMode === "plain" ? "static" : "auto",
      })
    : null;

  try {
    if (cliArguments.command === "keys") {
      await handleKeysCommand();
      return;
    }

    if (cliArguments.invalidOptions.length > 0) {
      await exitWithMessage(
        indicator,
        `unknown option(s): ${cliArguments.invalidOptions.join(", ")}`,
        1,
      );
      return;
    }

    if (cliArguments.invalidSuiteFlags.length > 0) {
      await exitWithMessage(
        indicator,
        `unknown suite flag(s): ${cliArguments.invalidSuiteFlags.join(", ")}`,
        1,
      );
      return;
    }

    if (cliArguments.invalidSuiteExclusions.length > 0) {
      await exitWithMessage(
        indicator,
        `unknown suite exclusion(s): ${cliArguments.invalidSuiteExclusions.join(", ")}`,
        1,
      );
      return;
    }

    if (cliArguments.directStep) {
      await runDirectStepCommand(
        indicator,
        cliArguments.directStep,
        cliArguments.directStepArgs,
      );
      return;
    }

    await runSuiteCommand(indicator, cliArguments);
  } finally {
    await indicator?.stop();
  }
}

async function exitWithMessage(
  indicator: CheckingIndicatorController | null,
  message: string,
  exitCode: number,
): Promise<void> {
  await indicator?.stop();
  writeOut(message);
  process.exit(exitCode);
}

async function handleKeysCommand(): Promise<void> {
  const { getConfiguredStepKeys } =
    await import("@/cli/args/selection/arguments.ts");
  writeOut(getConfiguredStepKeys().join(", "));
  process.exit(0);
}

function isHelpRequest(argv: string[]): boolean {
  const args = argv.slice(2);
  const passthroughSeparatorIndex = args.indexOf("--");
  const parsedArgs =
    passthroughSeparatorIndex >= 0
      ? args.slice(0, passthroughSeparatorIndex)
      : args;
  return parsedArgs.some((arg) => HELP_FLAGS.has(arg));
}

async function loadCliArguments(argv: string[]) {
  const { parseCliArguments } = await import("@/cli/args/parser.ts");
  return parseCliArguments(argv);
}

async function runDirectStepCommand(
  indicator: CheckingIndicatorController | null,
  directStep: NonNullable<
    Awaited<ReturnType<typeof loadCliArguments>>["directStep"]
  >,
  directStepArgs: string[],
): Promise<void> {
  const [{ SUITE_TIMEOUT_MS }, { runStepWithinDeadline }] = await Promise.all([
    import("@/runtime-config/index.ts"),
    import("@/step/index.ts"),
  ]);
  const result = await runStepWithinDeadline(
    directStep,
    Date.now() + SUITE_TIMEOUT_MS,
    directStepArgs,
  );
  await indicator?.stop();
  writeOut(result.output);
  process.exit(result.exitCode);
}

async function runSuiteCommand(
  indicator: CheckingIndicatorController | null,
  cliArguments: Awaited<ReturnType<typeof loadCliArguments>>,
): Promise<void> {
  const { runCheckSuite } = await import("@/suite-processing/index.ts");
  await runCheckSuite(cliArguments.keyFilter, {
    excludedKeys: cliArguments.excludedKeys,
    failureOutputLineLimit: cliArguments.failureOutputLineLimit,
    indicator: indicator ?? undefined,
    outputMode: cliArguments.outputMode,
    renderMode: cliArguments.renderMode,
    summaryOnly: cliArguments.command === "summary",
  });
}

function shouldShowCheckingIndicator(cliArguments: {
  command: string;
  renderMode: "plain" | "styled";
}): boolean {
  return cliArguments.command !== "help" && cliArguments.command !== "keys";
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

function writeOut(output: string): void {
  process.stdout.write(
    output.endsWith("\n") ? output : `${output.replace(/\s+$/g, "")}\n`,
  );
}
