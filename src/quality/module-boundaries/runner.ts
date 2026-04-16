import { fileURLToPath } from "node:url";

import { isRecord } from "@/foundation/index.ts";

const architectureWorkerPath = fileURLToPath(
  new URL("./worker.ts", import.meta.url),
);
const packageRoot = fileURLToPath(new URL("../../..", import.meta.url));

/** Normalized result of a non-blocking architecture analysis run. */
export interface ArchitectureCheckResult {
  exitCode: 0 | 1;
  output: string;
}

interface ArchitectureWorkerResult {
  output: string;
  violationCount: number;
}

/**
 * Runs architecture analysis in a Bun subprocess so large repository scans do
 * not block the host event loop used by the inline step runner.
 */
export async function runArchitectureCheck(
  cwd: string,
  configValue: unknown,
): Promise<ArchitectureCheckResult> {
  const serializedConfig = serializeArchitectureConfig(configValue);
  const child = Bun.spawn(
    [process.execPath, architectureWorkerPath, cwd, serializedConfig],
    {
      cwd: packageRoot,
      stderr: "pipe",
      stdin: "ignore",
      stdout: "pipe",
    },
  );
  const [rawStdout, rawStderr, workerExitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  if (workerExitCode !== 0) {
    throw new Error(
      buildWorkerFailureMessage(rawStderr, rawStdout, workerExitCode),
    );
  }

  const workerResult = parseArchitectureWorkerResult(rawStdout);
  return {
    exitCode: workerResult.violationCount === 0 ? 0 : 1,
    output: ensureTrailingNewline(workerResult.output),
  };
}

function buildWorkerFailureMessage(
  rawStderr: string,
  rawStdout: string,
  workerExitCode: number,
): string {
  const details =
    rawStderr.trim() || rawStdout.trim() || "architecture worker failed";
  return [
    `architecture worker exited with code ${workerExitCode}`,
    details,
  ].join("\n");
}

function ensureTrailingNewline(output: string): string {
  return output.endsWith("\n") ? output : `${output}\n`;
}

function parseArchitectureWorkerResult(
  rawStdout: string,
): ArchitectureWorkerResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawStdout) as unknown;
  } catch (error) {
    throw new Error(
      `architecture worker returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  if (!isRecord(parsed)) {
    throw new Error("architecture worker returned a non-object payload");
  }

  const output = parsed.output;
  const violationCount = parsed.violationCount;
  if (typeof output !== "string") {
    throw new Error("architecture worker payload is missing a string output");
  }
  if (
    typeof violationCount !== "number" ||
    !Number.isInteger(violationCount) ||
    violationCount < 0
  ) {
    throw new Error(
      "architecture worker payload is missing a non-negative violationCount",
    );
  }

  return { output, violationCount };
}

function serializeArchitectureConfig(configValue: unknown): string {
  try {
    return JSON.stringify(configValue);
  } catch (error) {
    throw new Error(
      `architecture config must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
