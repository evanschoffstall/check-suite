import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  defineCheckSuiteConfig,
  defineLabeledStepEntryGroup,
  defineMatchSummary,
  defineStepEntries,
  defineStepEntryHandlers,
  parseCheckConfigModule,
  withStepEntryDefaults,
} from "../src/config-schema/index.ts";
import {
  defineCommandStepSet,
  defineGitFileScanStep,
  defineStep,
} from "../src/step/index.ts";

describe("config authoring helpers", () => {
  test("accepts the object-form config shape", () => {
    const config = defineCheckSuiteConfig({
      paths: { reportPath: "coverage/lcov.info" },
      steps: [
        defineGitFileScanStep({
          command: "bunx",
          fileArgs: "secretlint --no-glob",
          label: "secretlint",
        }),
      ],
      suite: { timeoutMs: 1000 },
    });

    expect(config.paths.reportPath).toBe("coverage/lcov.info");
    expect(config.steps).toHaveLength(1);
    expect(config.steps[0]?.key).toBe("secretlint");
    expect(config.suite?.timeoutMs).toBe(1000);
  });

  test("accepts flat array config modules without a wrapper call", () => {
    const config = parseCheckConfigModule({
      default: [
        { paths: { reportPath: "coverage/lcov.info" } },
        defineStep({ args: "test", cmd: "custom-runner", label: "tests" }),
        { suite: { timeoutMs: 1000 } },
      ],
    });

    expect(config.paths.reportPath).toBe("coverage/lcov.info");
    expect(config.steps).toHaveLength(1);
    expect(config.steps[0]?.key).toBe("tests");
    expect(config.suite?.timeoutMs).toBe(1000);
  });

  test("accepts flat declarative kind entries with config-owned handlers", () => {
    const config = parseCheckConfigModule({
      default: [
        { paths: { reportPath: "coverage/lcov.info" } },
        {
          kinds: {
            command: defineStep,
            commands: { group: "command" },
            lint: { defaults: { handler: "lint" }, factory: defineStep },
          },
        },
        { args: "test", cmd: "custom-runner", kind: "command", label: "tests" },
        { args: "eslint .", kind: "lint", label: "eslint" },
        {
          args: "coverage",
          kind: "command",
          label: "coverage",
          summary: {
            default: "ok",
            match: "{1}%",
            regex: "(\\d+)%",
          },
        },
        {
          defaults: { cmd: "bun" },
          items: { tsc: "tsc --noEmit" },
          kind: "commands",
        },
        { suite: { timeoutMs: 1000 } },
      ],
    });

    expect(config.paths.reportPath).toBe("coverage/lcov.info");
    expect(config.steps).toHaveLength(4);
    expect(config.steps[0]?.cmd).toBe("custom-runner");
    expect(config.steps[0]?.key).toBe("tests");
    expect(config.steps[1]?.handler).toBe("lint");
    expect(config.steps[2]?.summary?.type).toBe("pattern");
    if (config.steps[2]?.summary?.type !== "pattern") {
      throw new Error(
        "coverage summary did not normalize to a pattern summary",
      );
    }
    expect(config.steps[2].summary.patterns[0]?.type).toBe("match");
    expect(config.steps[3]?.args).toEqual(["tsc", "--noEmit"]);
    expect(config.steps[3]?.cmd).toBe("bun");
  });

  test("builds pattern summaries without raw object boilerplate", () => {
    const summary = defineMatchSummary("no matches", {
      format: "{1} errors",
      regex: "(\\d+) errors",
    });

    expect(summary.type).toBe("pattern");
    expect(summary.patterns[0]?.type).toBe("match");
  });

  test("supports attaching custom post-processing to a generic step", () => {
    const step = defineStep({
      args: "test",
      cmd: "custom-runner",
      label: "tests",
      postProcess: { source: () => ({ status: "pass", summary: "ok" }) },
    });

    expect(step.cmd).toBe("custom-runner");
    expect(step.postProcess).toBeDefined();
    expect(step.key).toBe("tests");
  });

  test("builds small command step sets from tuple descriptors", () => {
    const steps = defineCommandStepSet([
      ["knip", "knip --config knip.json --cache", { failMsg: "knip failed" }],
      ["audit", "audit", { cmd: "bun", failMsg: "bun audit failed" }],
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0]?.args).toEqual([
      "knip",
      "--config",
      "knip.json",
      "--cache",
    ]);
    expect(steps[1]?.cmd).toBe("bun");
  });

  test("builds declarative step entries from config-owned kind handlers", () => {
    const steps = defineStepEntries(
      [
        { args: "knip --cache", kind: "command", label: "knip" },
        { args: "eslint .", kind: "lint", label: "eslint" },
        { items: { tsc: "tsc --noEmit" }, kind: "commands" },
      ],
      defineStepEntryHandlers({
        command: defineStep,
        commands: defineLabeledStepEntryGroup("command"),
        lint: withStepEntryDefaults(defineStep, { handler: "lint" }),
      }),
    );

    expect(steps.map((step) => step.key)).toEqual(["knip", "lint", "tsc"]);
    expect(steps[0]?.cmd).toBe("bunx");
    expect(steps[1]?.handler).toBe("lint");
    expect(steps[2]?.args).toEqual(["tsc", "--noEmit"]);
  });

  test("keeps the root config at or below 300 lines", () => {
    const lineCount = readFileSync(
      join(process.cwd(), "check-suite.config.ts"),
      "utf8",
    )
      .trimEnd()
      .split(/\r?\n/u).length;

    expect(lineCount).toBeLessThanOrEqual(300);
  });
});
