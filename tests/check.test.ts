import { describe, expect, test } from "bun:test";

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
});
