import { afterEach, describe, expect, mock, test } from "bun:test";

import type { Command, StepConfig, Summary } from "../src/types/index.ts";

import {
  defineNumberRecord,
  parseAssignments,
} from "../src/foundation/assignments.ts";
import {
  assignNestedRecordValue,
  readStringArrayPath,
} from "../src/foundation/record-paths.ts";
import { buildPatternSummary } from "../src/summary/patterns.ts";
import { buildSimpleSummary } from "../src/summary/simple.ts";
import { buildTableRowSummary } from "../src/summary/table-row.ts";

/**
 * These regressions recover coverage for pure helper modules that were imported
 * from the 2.0.0 snapshot without their corresponding tests.
 */

let runnerImportVersion = 0;

function createCommand(overrides: Partial<Command> = {}): Command {
  return {
    exitCode: 0,
    output: "",
    timedOut: false,
    ...overrides,
  };
}

function createStep(overrides: Partial<StepConfig> = {}): StepConfig {
  return {
    key: "example",
    label: "example",
    ...overrides,
  };
}

async function importRunnerModule() {
  runnerImportVersion += 1;
  return import(`../src/post-process/runner.ts?case=${runnerImportVersion}`);
}

afterEach(() => {
  mock.restore();
});

describe("assignment helpers", () => {
  test("parseAssignments splits whitespace-delimited key-value pairs", () => {
    expect(parseAssignments("alpha=1 beta=2\ngamma=3")).toEqual([
      ["alpha", "1"],
      ["beta", "2"],
      ["gamma", "3"],
    ]);
  });

  test("parseAssignments rejects entries without a key separator", () => {
    expect(() => parseAssignments("alpha=1 invalid")).toThrow(
      "invalid assignment: invalid",
    );
  });

  test("defineNumberRecord converts numeric values after parsing", () => {
    expect(defineNumberRecord("alpha=1 beta=2.5 gamma=-3")).toEqual({
      alpha: 1,
      beta: 2.5,
      gamma: -3,
    });
  });
});

describe("record path helpers", () => {
  test("assignNestedRecordValue creates null-prototype intermediate records", () => {
    const target: Record<string, unknown> = {};

    assignNestedRecordValue(target, ["alpha", "beta", "gamma"], 42);

    expect(target.alpha).toEqual({ beta: { gamma: 42 } });
    expect(Object.getPrototypeOf(target.alpha as object)).toBe(null);
    expect(
      Object.getPrototypeOf(
        (target.alpha as Record<string, unknown>).beta as object,
      ),
    ).toBe(null);
  });

  test("assignNestedRecordValue replaces non-record branches before descending", () => {
    const target: Record<string, unknown> = { alpha: 10 };

    assignNestedRecordValue(target, ["alpha", "beta"], "value");

    expect(target.alpha).toEqual({ beta: "value" });
  });

  test("assignNestedRecordValue rejects empty and unsafe segments", () => {
    expect(() => assignNestedRecordValue({}, [], "value")).toThrow(
      "record path must contain at least one segment",
    );
    expect(() =>
      assignNestedRecordValue({}, ["safe", "__proto__"], "value"),
    ).toThrow("unsafe record path segment: __proto__");
  });

  test("readStringArrayPath follows object and array segments and filters non-strings", () => {
    const value = {
      suites: [{ names: ["alpha", 2, "beta", false] }],
    };

    expect(readStringArrayPath(value, "suites.0.names")).toEqual([
      "alpha",
      "beta",
    ]);
    expect(readStringArrayPath(value, "suites.1.names")).toEqual([]);
    expect(readStringArrayPath(value, "suites.0.missing")).toEqual([]);
  });
});

describe("summary helpers", () => {
  test("buildSimpleSummary covers pass, failure, and timeout variants", () => {
    const step = createStep({ failMsg: "step failed" });

    expect(buildSimpleSummary(step, createCommand())).toBe("passed");
    expect(
      buildSimpleSummary(
        step,
        createCommand({ exitCode: 1, output: "$ cmd\nfirst failure\nsecond" }),
      ),
    ).toBe("step failed: first failure");
    expect(
      buildSimpleSummary(step, createCommand({ exitCode: 1, output: "$ cmd" })),
    ).toBe("step failed");
    expect(
      buildSimpleSummary(
        step,
        createCommand({
          exitCode: 1,
          output: "$ cmd\nTimed out after 1000ms",
          timedOut: true,
        }),
      ),
    ).toBe("step failed: example exceeded its timeout");
    expect(
      buildSimpleSummary(
        createStep({ label: "lint" }),
        createCommand({ exitCode: 1, output: "$ cmd", timedOut: true }),
      ),
    ).toBe("lint exceeded its timeout");
  });

  test("buildTableRowSummary extracts configured cells and rejects malformed rows", () => {
    const pattern = {
      cellSep: "│",
      format: "{4} · {5} · {6} · {1}",
      regex: "│ Total:",
      type: "table-row",
    } as const;

    expect(
      buildTableRowSummary(pattern, {
        exitCode: 0,
        output:
          "│ Total: │ 8 files │ ignored │ ignored │ 3 clones │ 12 lines │ 24 tokens │",
        timedOut: false,
      }),
    ).toBe("3 clones · 12 lines · 24 tokens · 8 files");
    expect(
      buildTableRowSummary(pattern, {
        exitCode: 0,
        output: "│ Total: │ only │ three │ cells │",
        timedOut: false,
      }),
    ).toBeNull();
    expect(
      buildTableRowSummary(pattern, {
        exitCode: 0,
        output: "no totals here",
        timedOut: false,
      }),
    ).toBeNull();
  });

  test("buildPatternSummary resolves count, literal, regex, table, and default branches", () => {
    const summary = {
      default: "default summary",
      patterns: [
        {
          format: "{count} errors in {target}",
          regex: "error",
          type: "count",
        },
        {
          format: "literal matched {target}",
          regex: "ready",
          type: "literal",
        },
        {
          format: "found {1} warnings in {target}",
          regex: "warnings: (\\d+)",
          type: "match",
        },
        {
          cellSep: "|",
          format: "{4} clones in {1}",
          regex: "Total:",
          type: "table-row",
        },
      ],
      type: "pattern",
    } satisfies Summary;

    expect(
      buildPatternSummary(
        summary,
        createCommand({ output: "error\nerror\n" }),
        { "{target}": "lint" },
      ),
    ).toBe("2 errors in lint");
    expect(
      buildPatternSummary(
        { ...summary, patterns: summary.patterns.slice(1) },
        createCommand({ output: "ready\n" }),
        { "{target}": "suite" },
      ),
    ).toBe("literal matched suite");
    expect(
      buildPatternSummary(
        { ...summary, patterns: summary.patterns.slice(2) },
        createCommand({ output: "warnings: 7\n" }),
        { "{target}": "tests" },
      ),
    ).toBe("found 7 warnings in tests");
    expect(
      buildPatternSummary(
        { ...summary, patterns: summary.patterns.slice(3) },
        createCommand({
          output: "| Total: | 5 files | skip | skip | 2 clones |",
        }),
        { "{target}": "unused" },
      ),
    ).toBe("default summary");
    expect(
      buildPatternSummary(
        { ...summary, patterns: [] },
        createCommand({ output: "nothing" }),
        { "{target}": "unused" },
      ),
    ).toBe("default summary");
  });
});

describe("post-process runner", () => {
  test("runStepPostProcess returns null when the step has no runnable post-process", async () => {
    const { runStepPostProcess } = await importRunnerModule();

    await expect(
      runStepPostProcess(createStep(), createCommand(), "display"),
    ).resolves.toBeNull();
    await expect(
      runStepPostProcess(
        createStep({ postProcess: { source: () => ({ status: "pass" }) } }),
        createCommand({ notFound: true }),
        "display",
      ),
    ).resolves.toBeNull();
    await expect(
      runStepPostProcess(
        createStep({ postProcess: { source: () => ({ status: "pass" }) } }),
        createCommand({ timedOut: true }),
        "display",
      ),
    ).resolves.toBeNull();
  });

  test("runStepPostProcess normalizes successful inline post-process results", async () => {
    mock.module("@/inline-ts/index.ts", () => ({
      resolveInlineTypeScriptRunner: async () => async () => ({
        messages: [{ text: "ok", tone: "info" }],
        status: "pass",
        summary: "post-process passed",
      }),
    }));
    const { runStepPostProcess } = await importRunnerModule();

    await expect(
      runStepPostProcess(
        createStep({ postProcess: { data: { alpha: 1 }, source: "ignored" } }),
        createCommand(),
        "display",
      ),
    ).resolves.toEqual({
      messages: [{ text: "ok", tone: "info" }],
      output: undefined,
      status: "pass",
      summary: "post-process passed",
    });
  });

  test("runStepPostProcess converts invalid results into a readable failure", async () => {
    mock.module("@/inline-ts/index.ts", () => ({
      resolveInlineTypeScriptRunner: async () => async () => ({
        status: "maybe",
      }),
    }));
    const { runStepPostProcess } = await importRunnerModule();

    await expect(
      runStepPostProcess(
        createStep({ label: "coverage", postProcess: { source: "ignored" } }),
        createCommand(),
        "display",
      ),
    ).resolves.toEqual({
      messages: [
        {
          text: "coverage post-process returned an invalid result",
          tone: "fail",
        },
      ],
      status: "fail",
      summary: "coverage post-process returned an invalid result",
    });
  });

  test("runStepPostProcess surfaces thrown runner failures with the step label", async () => {
    mock.module("@/inline-ts/index.ts", () => ({
      resolveInlineTypeScriptRunner: async () => {
        throw new Error("boom");
      },
    }));
    const { runStepPostProcess } = await importRunnerModule();

    await expect(
      runStepPostProcess(
        createStep({ label: "coverage", postProcess: { source: "ignored" } }),
        createCommand(),
        "display",
      ),
    ).resolves.toEqual({
      messages: [
        {
          text: "coverage post-process failed: boom",
          tone: "fail",
        },
      ],
      status: "fail",
      summary: "coverage post-process failed: boom",
    });
  });
});
