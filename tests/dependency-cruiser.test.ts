import { describe, expect, test } from "bun:test";

import { dependencyCruiserStep } from "../check-suite-config/steps/dependency-cruiser.ts";

describe("dependency-cruiser suite wiring", () => {
  test("uses the repository dependency policy file", () => {
    expect(dependencyCruiserStep.args).toEqual([
      "depcruise",
      "--config",
      ".dependency-cruiser.cjs",
      "src",
      "check-suite-config",
      "check-suite.config.ts",
      "--output-type",
      "err",
    ]);
  });

  test("loads the dependency policy without violations", () => {
    const result = Bun.spawnSync(
      [
        "bunx",
        "depcruise",
        "--config",
        ".dependency-cruiser.cjs",
        "src",
        "check-suite-config",
        "check-suite.config.ts",
        "--output-type",
        "err",
      ],
      {
        cwd: process.cwd(),
        stderr: "pipe",
        stdout: "pipe",
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString().trim()).toBe("");
    expect(result.stdout.toString()).toContain(
      "no dependency violations found",
    );
  });
});