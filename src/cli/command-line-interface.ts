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
  "  ---no=<step-key>     Exclude a suite step",
  "  --<step-key>         Run only the named suite step(s)",
  "  --help, -h           Show this help text",
  "",
  "Examples:",
  "  check-suite",
  "  check-suite --output=all",
  "  check-suite summary --eslint",
  "  check-suite junit -- --watch",
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
  const indicator = shouldShowCheckingIndicator(argv) ? startCheckingIndicator() : null;

  try {
    const cliArguments = await loadCliArguments(argv);

    if (cliArguments.command === "help") {
      writeOut(HELP_TEXT);
      return;
    }

    if (cliArguments.command === "keys") {
      await handleKeysCommand(); return;
    }

    if (cliArguments.invalidOptions.length > 0) {
      await exitWithMessage(
        indicator,
        `unknown option(s): ${cliArguments.invalidOptions.join(", ")}`,
        1,
      ); return;
    }

    if (cliArguments.invalidSuiteFlags.length > 0) {
      await exitWithMessage(
        indicator,
        `unknown suite flag(s): ${cliArguments.invalidSuiteFlags.join(", ")}`,
        1,
      ); return;
    }

    if (cliArguments.invalidSuiteExclusions.length > 0) {
      await exitWithMessage(
        indicator,
        `unknown suite exclusion(s): ${cliArguments.invalidSuiteExclusions.join(", ")}`,
        1,
      ); return;
    }

    if (cliArguments.directStep) {
      await runDirectStepCommand(
        indicator,
        cliArguments.directStep,
        cliArguments.directStepArgs,
      ); return;
    }

    await runSuiteCommand(indicator, cliArguments);
  } finally {
    await indicator?.stop();
  }
}

async function exitWithMessage(
  indicator: null | { stop: () => Promise<void> },
  message: string,
  exitCode: number,
): Promise<void> {
  await indicator?.stop();
  writeOut(message);
  process.exit(exitCode);
}

async function handleKeysCommand(): Promise<void> {
  const { getConfiguredStepKeys } = await import(
    "@/cli/args/selection/arguments.ts"
  );
  writeOut(getConfiguredStepKeys().join(", "));
  process.exit(0);
}

function isHelpRequest(argv: string[]): boolean {
  const args = argv.slice(2);
  const passthroughSeparatorIndex = args.indexOf("--");
  const parsedArgs =
    passthroughSeparatorIndex >= 0 ? args.slice(0, passthroughSeparatorIndex) : args;
  return parsedArgs.some((arg) => HELP_FLAGS.has(arg));
}

async function loadCliArguments(argv: string[]) {
  const { parseCliArguments } = await import("@/cli/args/parser.ts");
  return parseCliArguments(argv);
}

async function runDirectStepCommand(
  indicator: null | { stop: () => Promise<void> },
  directStep: NonNullable<Awaited<ReturnType<typeof loadCliArguments>>["directStep"]>,
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
  indicator: null | { stop: () => Promise<void> },
  cliArguments: Awaited<ReturnType<typeof loadCliArguments>>,
): Promise<void> {
  const { runCheckSuite } = await import("@/suite-processing/index.ts");
  await runCheckSuite(cliArguments.keyFilter, {
    excludedKeys: cliArguments.excludedKeys,
    indicator: indicator ?? undefined,
    outputMode: cliArguments.outputMode,
    summaryOnly: cliArguments.command === "summary",
  });
}

function shouldShowCheckingIndicator(argv: string[]): boolean {
  return argv[2] !== "keys" && !isHelpRequest(argv);
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

function writeOut(output: string): void {
  process.stdout.write(
    output.endsWith("\n") ? output : `${output.replace(/\s+$/g, "")}\n`,
  );
}
