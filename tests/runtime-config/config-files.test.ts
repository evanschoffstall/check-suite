import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../..");

/** Builds an isolated workspace so config discovery can run against real files. */
function createWorkspace(files: Record<string, string>): string {
  const workspaceDir = mkdtempSync(join(tmpdir(), "check-suite-config-files-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(workspaceDir, relativePath);
    mkdirSync(join(absolutePath, ".."), { recursive: true });
    writeFileSync(absolutePath, contents);
  }

  return workspaceDir;
}

describe("resolveCheckSuiteConfigPath", () => {
  const tempDirs: string[] = [];

  async function runConfigPathScenario(options: {
    configEnv?: string;
    workspaceDir: string;
  }): Promise<{ error?: string; path?: string }> {
    const process = Bun.spawn({
      cmd: [
        "bun",
        "--eval",
        String.raw`
process.chdir(${JSON.stringify(options.workspaceDir)});

if (${JSON.stringify(options.configEnv)} === undefined) {
  delete process.env.CHECK_SUITE_CONFIG;
} else {
  process.env.CHECK_SUITE_CONFIG = ${JSON.stringify(options.configEnv)};
}

const { resolveCheckSuiteConfigPath } = await import("@/runtime-config/config-files.ts");

try {
  console.log(JSON.stringify({ path: resolveCheckSuiteConfigPath() }));
} catch (error) {
  console.log(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }),
  );
}
`,
      ],
      cwd: repoRoot,
      stderr: "pipe",
      stdout: "pipe",
    });

    const [stderr, stdout, exitCode] = await Promise.all([
      new Response(process.stderr).text(),
      new Response(process.stdout).text(),
      process.exited,
    ]);

    if (exitCode !== 0) {
      throw new Error(
        `config-files scenario failed with exit code ${exitCode}\n${stderr}`,
      );
    }

    return JSON.parse(stdout) as { error?: string; path?: string };
  }

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test("prefers an explicit CHECK_SUITE_CONFIG path", async () => {
    const workspaceDir = createWorkspace({
      "check-suite.config.ts": "export default { paths: {}, steps: [] };\n",
      "custom/check-suite.config.ts": "export default { paths: {}, steps: [] };\n",
    });
    tempDirs.push(workspaceDir);
    const result = await runConfigPathScenario({
      configEnv: "custom/check-suite.config.ts",
      workspaceDir,
    });

    expect(result).toEqual({
      path: join(workspaceDir, "custom/check-suite.config.ts"),
    });
  });

  test("throws when an explicit CHECK_SUITE_CONFIG path is missing", async () => {
    const workspaceDir = createWorkspace({});
    tempDirs.push(workspaceDir);
    const result = await runConfigPathScenario({
      configEnv: "missing.config.ts",
      workspaceDir,
    });

    expect(result).toEqual({
      error:
      `Configured check-suite config path does not exist: ${join(workspaceDir, "missing.config.ts")}`,
    });
  });

  test("throws when multiple default config files are present", async () => {
    const workspaceDir = createWorkspace({
      "check-suite.config.mjs": "export default { paths: {}, steps: [] };\n",
      "check-suite.config.ts": "export default { paths: {}, steps: [] };\n",
    });
    tempDirs.push(workspaceDir);
    const result = await runConfigPathScenario({ workspaceDir });

    expect(result).toEqual({
      error:
      `Multiple check-suite config files found: ${join(workspaceDir, "check-suite.config.ts")}, ${join(workspaceDir, "check-suite.config.mjs")}`,
    });
  });

  test("throws when no default or explicit config path exists", async () => {
    const workspaceDir = createWorkspace({});
    tempDirs.push(workspaceDir);
    const result = await runConfigPathScenario({ workspaceDir });

    expect(result).toEqual({
      error:
        "No check-suite config file found. Create one of check-suite.config.ts, check-suite.config.mts, check-suite.config.js, check-suite.config.mjs or set CHECK_SUITE_CONFIG.",
    });
  });
});