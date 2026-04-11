import { analyzeArchitecture, formatArchitectureViolations } from "./analyze";

interface ArchitectureWorkerInput {
  configValue: unknown;
  cwd: string;
}

interface ArchitectureWorkerOutput {
  output: string;
  violationCount: number;
}

/**
 * CLI entrypoint for the spawned architecture worker. The parent process
 * validates both the argv payload and the JSON result it reads back.
 */
function main(): void {
  const { configValue, cwd } = parseWorkerInput(process.argv.slice(2));
  const violations = analyzeArchitecture(cwd, configValue);
  writeWorkerOutput({
    output: formatArchitectureViolations(violations),
    violationCount: violations.length,
  });
}

function parseWorkerInput(argv: string[]): ArchitectureWorkerInput {
  const [cwd, serializedConfig] = argv;
  if (typeof cwd !== "string" || cwd.length === 0) {
    throw new Error("architecture worker requires a target cwd argument");
  }
  if (typeof serializedConfig !== "string") {
    throw new Error("architecture worker requires a serialized config argument");
  }

  let configValue: unknown;
  try {
    configValue = JSON.parse(serializedConfig) as unknown;
  } catch (error) {
    throw new Error(
      `architecture worker config is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  return { configValue, cwd };
}

function writeWorkerOutput(payload: ArchitectureWorkerOutput): void {
  process.stdout.write(JSON.stringify(payload));
}

main();