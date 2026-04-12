import { describe, expect, test } from "bun:test";

import {
  collectSelectionState,
  resolveSuiteFlagDirectStep,
} from "@/cli/args/selection/state.ts";

describe("suite selection state", () => {
  test("collectSelectionState separates flags, args, and exclusions", () => {
    const state = collectSelectionState([
      "--junit",
      "---no=eslint",
      "---no=",
      "--unknown-step",
      "path/to/file.ts",
    ]);

    expect(state.suiteFlags).toContain("junit");
    expect(state.suiteFlags).toContain("unknown-step");
    expect(state.exclusions).toContain("eslint");
    expect(state.suiteStepArgs).toEqual(["path/to/file.ts"]);
    expect(state.invalidSuiteExclusions).toContain("---no=");
    expect(state.invalidSuiteFlags).toContain("unknown-step");
  });

  test("resolveSuiteFlagDirectStep returns a direct step when exactly one valid flag allows args", () => {
    const resolved = resolveSuiteFlagDirectStep(
      ["junit"],
      ["--reporter=junit"],
      ["--timeout=1000"],
      [],
      [],
    );

    expect(resolved).not.toBeNull();
    expect(resolved?.step.key).toBe("junit");
    expect(resolved?.args).toEqual(["--reporter=junit", "--timeout=1000"]);
  });

  test("resolveSuiteFlagDirectStep returns null when there are invalid suite flags or exclusions", () => {
    const withInvalidFlag = resolveSuiteFlagDirectStep(
      ["junit"],
      ["--reporter=junit"],
      [],
      ["bad-flag"],
      [],
    );
    const withInvalidExclusion = resolveSuiteFlagDirectStep(
      ["junit"],
      ["--reporter=junit"],
      [],
      [],
      ["---no="],
    );

    expect(withInvalidFlag).toBeNull();
    expect(withInvalidExclusion).toBeNull();
  });

  test("resolveSuiteFlagDirectStep returns null when no suite args are provided", () => {
    const resolved = resolveSuiteFlagDirectStep(["junit"], [], [], [], []);
    expect(resolved).toBeNull();
  });
});
