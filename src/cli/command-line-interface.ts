import { startCheckingIndicator } from "@/suite-processing/checking-indicator/index.ts";

// ---------------------------------------------------------------------------
// Output helper
// ---------------------------------------------------------------------------

/** Parses CLI arguments and dispatches to the appropriate runner. */
export async function main(): Promise<void> {
  const argv = Bun.argv;
  const indicator = shouldShowCheckingIndicator(argv) ? startCheckingIndicator() : null;

  try {
    const cliArguments = await loadCliArguments(argv);

    if (cliArguments.command === "keys") {
      await handleKeysCommand(); return;
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
    summaryOnly: cliArguments.command === "summary",
  });
}

function shouldShowCheckingIndicator(argv: string[]): boolean {
  return argv[2] !== "keys";
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

function writeOut(output: string): void {
  process.stdout.write(
    output.endsWith("\n") ? output : `${output.replace(/\s+$/g, "")}\n`,
  );
}
