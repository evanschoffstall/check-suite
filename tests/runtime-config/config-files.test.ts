import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveCheckSuiteConfigPath } from "@/runtime-config/config-files.ts";

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
  const originalCwd = process.cwd();
  const originalConfigEnv = process.env.CHECK_SUITE_CONFIG;
  const tempDirs: string[] = [];

  afterEach(() => {
    process.chdir(originalCwd);

    if (originalConfigEnv === undefined) {
      delete process.env.CHECK_SUITE_CONFIG;
    } else {
      process.env.CHECK_SUITE_CONFIG = originalConfigEnv;
    }

    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  test("prefers an explicit CHECK_SUITE_CONFIG path", () => {
    const workspaceDir = createWorkspace({
      "check-suite.config.ts": "export default { paths: {}, steps: [] };\n",
      "custom/check-suite.config.ts": "export default { paths: {}, steps: [] };\n",
    });
    tempDirs.push(workspaceDir);
    process.chdir(workspaceDir);
    process.env.CHECK_SUITE_CONFIG = "custom/check-suite.config.ts";

    expect(resolveCheckSuiteConfigPath()).toBe(
      join(workspaceDir, "custom/check-suite.config.ts"),
    );
  });

  test("throws when an explicit CHECK_SUITE_CONFIG path is missing", () => {
    const workspaceDir = createWorkspace({});
    tempDirs.push(workspaceDir);
    process.chdir(workspaceDir);
    process.env.CHECK_SUITE_CONFIG = "missing.config.ts";

    expect(() => resolveCheckSuiteConfigPath()).toThrow(
      `Configured check-suite config path does not exist: ${join(workspaceDir, "missing.config.ts")}`,
    );
  });

  test("throws when multiple default config files are present", () => {
    const workspaceDir = createWorkspace({
      "check-suite.config.mjs": "export default { paths: {}, steps: [] };\n",
      "check-suite.config.ts": "export default { paths: {}, steps: [] };\n",
    });
    tempDirs.push(workspaceDir);
    process.chdir(workspaceDir);
    delete process.env.CHECK_SUITE_CONFIG;

    expect(() => resolveCheckSuiteConfigPath()).toThrow(
      `Multiple check-suite config files found: ${join(workspaceDir, "check-suite.config.ts")}, ${join(workspaceDir, "check-suite.config.mjs")}`,
    );
  });

  test("throws when no default or explicit config path exists", () => {
    const workspaceDir = createWorkspace({});
    tempDirs.push(workspaceDir);
    process.chdir(workspaceDir);
    delete process.env.CHECK_SUITE_CONFIG;

    expect(() => resolveCheckSuiteConfigPath()).toThrow(
      "No check-suite config file found. Create one of check-suite.config.ts, check-suite.config.mts, check-suite.config.js, check-suite.config.mjs or set CHECK_SUITE_CONFIG.",
    );
  });
});