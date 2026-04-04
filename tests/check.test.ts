import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("check CLI", () => {
  test("runs when invoked as bun src/check.ts keys", async () => {
    const result = Bun.spawnSync(["bun", "src/check.ts", "keys"], {
      cwd: process.cwd(),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString().trim();

    expect(result.exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout.length).toBeGreaterThan(0);
    expect(stdout).toContain("knip");
  });

  test("runs when invoked as bun run start keys", async () => {
    const result = Bun.spawnSync(["bun", "run", "start", "keys"], {
      cwd: process.cwd(),
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = result.stdout.toString().trim();
    const stderr = result.stderr.toString().trim();

    expect(result.exitCode).toBe(0);
    expect(stderr.includes("error:")).toBe(false);
    expect(stdout.length).toBeGreaterThan(0);
    expect(stdout).toContain("knip");
  });

  test("loads a TypeScript config module with multiline inline functions", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "check-suite-config-"));

    try {
      writeFileSync(join(tempDir, "package.json"), "{}\n");
      writeFileSync(
        join(tempDir, "check-suite.config.ts"),
        [
          "export default {",
          "  paths: {},",
          "  steps: [",
          "    {",
          '      key: "demo",',
          '      label: "demo",',
          '      handler: "inline-ts",',
          '      enabled: true,',
          '      summary: { type: "simple" },',
          "      config: {",
          "        source: async ({ ok }) => {",
          '          const lines = ["alpha", "beta"];',
          '          return ok(lines.join("\\n") + "\\n");',
          "        },",
          "      },",
          "    },",
          "  ],",
          "};",
          "",
        ].join("\n"),
      );

      const result = Bun.spawnSync(["bun", join(process.cwd(), "src/check.ts"), "demo"], {
        cwd: tempDir,
        stderr: "pipe",
        stdout: "pipe",
      });

      const stdout = result.stdout.toString().trim();
      const stderr = result.stderr.toString().trim();

      expect(result.exitCode).toBe(0);
      expect(stderr).toBe("");
      expect(stdout).toContain("alpha");
      expect(stdout).toContain("beta");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
