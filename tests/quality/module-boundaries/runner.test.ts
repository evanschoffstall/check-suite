import { describe, expect, test } from "bun:test";

import {
  analyzeArchitecture,
  formatArchitectureViolations,
  runArchitectureCheck,
} from "@/quality/module-boundaries/index.ts";

import { createTempRepoFactory } from "./temp-repo";

const createTempRepo = createTempRepoFactory(
  "check-suite-architecture-runner-",
);

describe("architecture runner", () => {
  test("returns the same formatted result as the synchronous analyzer with explicit config", async () => {
    const repoDir = createTempRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts":
        'import { summarize } from "../summary/index.ts";\nexport const run = () => summarize();\n',
      "src/summary/index.ts": "export const summarize = () => 'done';\n",
    });
    const configValue = {
      dependencyPolicies: [
        { mayDependOn: [], name: "process", pathPrefixes: ["src/process"] },
        { mayDependOn: [], name: "summary", pathPrefixes: ["src/summary"] },
      ],
      includeRootFiles: false,
      rootDirectories: ["src"],
    };

    const expectedViolations = analyzeArchitecture(repoDir, configValue);
    const expectedOutput = formatArchitectureViolations(expectedViolations);
    const result = await runArchitectureCheck(repoDir, configValue);

    expect(result).toEqual({ exitCode: 1, output: expectedOutput });
  });

  test("inferPolicies mode runs inference inside the worker and returns a valid result", async () => {
    const repoDir = createTempRepo({
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts": "export const run = () => 'done';\n",
      "src/summary/index.ts": "export const summarize = () => 'done';\n",
    });

    // inferPolicies delegates entrypoint/policy discovery to the subprocess —
    // the main process must not call any inferXxx functions itself.
    const result = await runArchitectureCheck(repoDir, {
      includeRootFiles: false,
      inferPolicies: true,
      rootDirectories: ["src"],
    });

    // The result must be a well-formed ArchitectureCheckResult regardless of
    // whether there are violations in the temporary fixture.
    expect(typeof result.output).toBe("string");
    expect(result.output.length).toBeGreaterThan(0);
    expect([0, 1]).toContain(result.exitCode);
  });
});