import { describe, expect, test } from "bun:test";

import type { ArchitectureAnalyzerConfig } from "@/quality/module-boundaries/foundation/index.ts";

import {
  analyzeArchitecture as analyzeArchitectureBase,
  formatArchitectureViolations,
  inferDependencyPolicies as inferDependencyPoliciesBase,
  runArchitectureCheck as runArchitectureCheckBase,
} from "@/quality/module-boundaries/index.ts";

import { createTempRepoFactory } from "./temp-repo";
import { withTestCodeTargets } from "./test-code-targets";

const createTempRepo = createTempRepoFactory(
  "check-suite-architecture-runner-",
);
const analyzeArchitecture = (
  repoDir: string,
  config: Partial<ArchitectureAnalyzerConfig>,
) => analyzeArchitectureBase(repoDir, withTestCodeTargets(config));
const inferDependencyPolicies = (
  repoDir: string,
  config: Partial<ArchitectureAnalyzerConfig>,
) => inferDependencyPoliciesBase(repoDir, withTestCodeTargets(config));
const runArchitectureCheck = (
  repoDir: string,
  config: unknown,
) => runArchitectureCheckBase(
  repoDir,
  typeof config === "object" && config !== null
    ? withTestCodeTargets(config as Partial<ArchitectureAnalyzerConfig>)
    : config,
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
      inferPolicies: true,
      rootDirectories: ["src"],
    });

    // The result must be a well-formed ArchitectureCheckResult regardless of
    // whether there are violations in the temporary fixture.
    expect(typeof result.output).toBe("string");
    expect(result.output.length).toBeGreaterThan(0);
    expect([0, 1]).toContain(result.exitCode);
  });

  test("inferPolicies mode merges explicit dependency policies into inferred ones", async () => {
    const repoDir = createTempRepo({
      "src/api/index.ts": 'export { listUsers } from "./users.ts";\n',
      "src/api/users.ts": "export const listUsers = () => ['a'];\n",
      "src/process/index.ts": 'export { run } from "./runner.ts";\n',
      "src/process/runner.ts":
        'import { listUsers } from "../api/index.ts";\nexport const run = () => listUsers();\n',
      "src/summary/index.ts": "export const summarize = () => 'done';\n",
    });
    const inferredPolicies = inferDependencyPolicies(repoDir, {
      rootDirectories: ["src"],
    });
    const expectedPolicies = inferredPolicies.map((policy) =>
      policy.name === "api"
        ? {
            ...policy,
            mayDependOn: ["summary"],
          }
        : policy
    );
    const expectedViolations = analyzeArchitecture(repoDir, {
      dependencyPolicies: expectedPolicies,
      rootDirectories: ["src"],
    });
    const expectedOutput = formatArchitectureViolations(expectedViolations);

    const result = await runArchitectureCheck(repoDir, {
      discovery: {
        rootDirectories: ["src"],
      },
      policy: {
        dependencyPolicies: [
          {
            mayDependOn: ["summary"],
            name: "api",
            pathPrefixes: ["src/api"],
          },
        ],
        infer: true,
      },
    });

    expect(result).toEqual({
      exitCode: expectedViolations.length === 0 ? 0 : 1,
      output: expectedOutput,
    });
  });
});