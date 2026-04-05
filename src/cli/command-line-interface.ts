import { getConfiguredStepKeys, parseCliArguments } from "@/cli/args/index.ts";
import { SUITE_TIMEOUT_MS } from "@/runtime-config/index.ts";
import { runStepWithinDeadline } from "@/step/index.ts";
import { runCheckSuite } from "@/suite-processing/index.ts";

// ---------------------------------------------------------------------------
// Output helper
// ---------------------------------------------------------------------------

/** Parses CLI arguments and dispatches to the appropriate runner. */
export async function main(): Promise<void> {
  const cliArguments = parseCliArguments(Bun.argv);

  if (cliArguments.command === "keys") {
    writeOut(getConfiguredStepKeys().join(", "));
    process.exit(0);
  }

  if (cliArguments.invalidSuiteFlags.length > 0) {
    writeOut(
      `unknown suite flag(s): ${cliArguments.invalidSuiteFlags.join(", ")}`,
    );
    process.exit(1);
  }

  if (cliArguments.invalidSuiteExclusions.length > 0) {
    writeOut(
      `unknown suite exclusion(s): ${cliArguments.invalidSuiteExclusions.join(", ")}`,
    );
    process.exit(1);
  }

  if (cliArguments.directStep) {
    const result = await runStepWithinDeadline(
      cliArguments.directStep,
      Date.now() + SUITE_TIMEOUT_MS,
      cliArguments.directStepArgs,
    );
    writeOut(result.output);
    process.exit(result.exitCode);
  }

  await runCheckSuite(cliArguments.keyFilter, {
    excludedKeys: cliArguments.excludedKeys,
    summaryOnly: cliArguments.command === "summary",
  });
}

// ---------------------------------------------------------------------------
// Main entrypoint
// ---------------------------------------------------------------------------

function writeOut(output: string): void {
  process.stdout.write(
    output.endsWith("\n") ? output : `${output.replace(/\s+$/g, "")}\n`,
  );
}
