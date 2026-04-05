import { afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Creates a temporary repository factory for one test file and automatically
 * deletes every created repo after each test.
 */
export function createTempRepoFactory(
  prefix: string,
): (files: Record<string, string>) => string {
  const tempDirectories: string[] = [];

  afterEach(() => {
    cleanupTempDirectories(tempDirectories);
  });

  return (files) => {
    const repoDir = mkdtempSync(join(tmpdir(), prefix));
    tempDirectories.push(repoDir);
    writeFixtureTsConfig(repoDir);
    writeFixtureFiles(repoDir, files);
    return repoDir;
  };
}

/** Removes every temporary repository created for a test file. */
function cleanupTempDirectories(tempDirectories: string[]): void {
  for (const directoryPath of tempDirectories.splice(0)) {
    rmSync(directoryPath, { force: true, recursive: true });
  }
}

/** Writes the requested fixture files into the temporary repository. */
function writeFixtureFiles(
  repoDir: string,
  files: Record<string, string>,
): void {
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(repoDir, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  }
}

/** Writes the minimal tsconfig required by the repository fixture harness. */
function writeFixtureTsConfig(repoDir: string): void {
  writeFileSync(
    join(repoDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          allowImportingTsExtensions: true,
          module: "Preserve",
          moduleResolution: "Bundler",
          target: "ES2022",
        },
      },
      null,
      2,
    ),
  );
}