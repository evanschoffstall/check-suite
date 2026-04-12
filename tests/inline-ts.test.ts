import { describe, expect, test } from "bun:test";

import type { StepConfig } from "@/types/index.ts";

import { runInlineTypeScriptStep } from "@/inline-ts/index.ts";
import { toCommand } from "@/inline-ts/runner.ts";

// ---------------------------------------------------------------------------
// toCommand — inline result coercion
// ---------------------------------------------------------------------------

describe("toCommand", () => {
  test("returns null for non-record input", () => {
    expect(toCommand(null, 10)).toBeNull();
    expect(toCommand("string", 10)).toBeNull();
    expect(toCommand(42, 10)).toBeNull();
  });

  test("returns null when required fields are missing or wrong type", () => {
    expect(toCommand({ exitCode: "1", output: "x", timedOut: false }, 10)).toBeNull();
    expect(toCommand({ exitCode: 1, output: "x", timedOut: "false" }, 10)).toBeNull();
    expect(toCommand({ exitCode: 1, timedOut: false }, 10)).toBeNull();
  });

  test("does NOT set notFound from output text matching hasMissingSignal patterns", () => {
    // These phrases would trigger withMissingDetection on subprocess output,
    // but must not affect inline step results.
    const moduleNotFound = toCommand(
      { exitCode: 1, output: "Cannot find module 'some-pkg'\n", timedOut: false },
      10,
    );
    expect(moduleNotFound?.notFound).toBeUndefined();
    expect(moduleNotFound?.exitCode).toBe(1);

    const packageNotFound = toCommand(
      { exitCode: 1, output: "cannot find package 'lodash'\n", timedOut: false },
      10,
    );
    expect(packageNotFound?.notFound).toBeUndefined();

    const commandNotFound = toCommand(
      { exitCode: 127, output: "bash: some-tool: command not found\n", timedOut: false },
      10,
    );
    expect(commandNotFound?.notFound).toBeUndefined();
  });

  test("preserves explicit notFound: true when the inline step sets it", () => {
    const result = toCommand(
      { exitCode: 127, notFound: true, output: "not there", timedOut: false },
      10,
    );
    expect(result?.notFound).toBe(true);
  });

  test("uses fallbackDurationMs when durationMs is missing", () => {
    const result = toCommand(
      { exitCode: 0, output: "ok", timedOut: false },
      42,
    );
    expect(result?.durationMs).toBe(42);
  });

  test("uses result durationMs when provided", () => {
    const result = toCommand(
      { durationMs: 99, exitCode: 0, output: "ok", timedOut: false },
      42,
    );
    expect(result?.durationMs).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// runInlineTypeScriptStep — notFound must not be inferred from output text
// ---------------------------------------------------------------------------

const minimalStep = (
  source: (ctx: { fail: (o: string) => object; ok: (o: string) => object; }) => object,
): StepConfig => ({
  config: { source },
  enabled: true,
  failMsg: "step failed",
  handler: "inline-ts",
  key: "test-step",
  label: "test-step",
  passMsg: "",
  summary: { type: "simple" },
});

describe("runInlineTypeScriptStep", () => {
  test("step calling fail() with module-not-found text is notFound: undefined", async () => {
    const step = minimalStep(({ fail }) =>
      fail("Cannot find module 'missing-dependency'\n"),
    );
    const result = await runInlineTypeScriptStep(step);
    expect(result.exitCode).toBe(1);
    expect(result.notFound).toBeUndefined();
    expect(result.output).toContain("Cannot find module");
  });

  test("step calling ok() with command-not-found text is notFound: undefined", async () => {
    // An inline step may report tool diagnostics via ok(); this should not
    // incorrectly mark the step as notFound.
    const step = minimalStep(({ ok }) =>
      ok("bash: some-cli: command not found\n"),
    );
    const result = await runInlineTypeScriptStep(step);
    expect(result.exitCode).toBe(0);
    expect(result.notFound).toBeUndefined();
  });

  test("step that throws with module-not-found message is notFound: undefined", async () => {
    const step = minimalStep(() => {
      throw new Error("Cannot find module './worker.ts'");
    });
    const result = await runInlineTypeScriptStep(step);
    expect(result.exitCode).toBe(1);
    expect(result.notFound).toBeUndefined();
    expect(result.output).toContain("Cannot find module");
  });

  test("step that throws with cannot-find-package message is notFound: undefined", async () => {
    const step = minimalStep(() => {
      throw new Error("cannot find package 'some-tool'");
    });
    const result = await runInlineTypeScriptStep(step);
    expect(result.exitCode).toBe(1);
    expect(result.notFound).toBeUndefined();
  });

  test("Bun ResolveMessage missing package from inline runner is notFound: true", async () => {
    const step = minimalStep(() => {
      throw new Error(
        "ResolveMessage: Cannot find package 'purgecss' from '/tmp/repo/src/inline-ts/runner.ts'",
      );
    });
    const result = await runInlineTypeScriptStep(step);
    expect(result.exitCode).toBe(1);
    expect(result.notFound).toBe(true);
  });

  test("step calling ok() with clean output succeeds with no notFound", async () => {
    const step = minimalStep(({ ok }) => ok("all good\n"));
    const result = await runInlineTypeScriptStep(step);
    expect(result.exitCode).toBe(0);
    expect(result.notFound).toBeUndefined();
    expect(result.output).toBe("all good\n");
  });
});
