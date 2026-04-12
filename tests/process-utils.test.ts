import { describe, expect, test } from "bun:test";

import { createProcessCollectors, flushCollectors } from "@/process/collectors.ts";
import { buildCompletedCommand, waitForProcessOutcome } from "@/process/io.ts";
import {
  getBunxCommandTarget,
  hasExplicitPackageVersion,
  isBunxCommandAvailable,
} from "@/process/preflight/bunx.ts";
import {
  createProcessEnv,
  getPreflightFailure,
} from "@/process/preflight/environment.ts";
import { withMissingDetection } from "@/process/runner.ts";

describe("process preflight", () => {
  test("bunx target parsing and version checks", () => {
    expect(getBunxCommandTarget(["-y", "eslint"])) .toBe("eslint");
    expect(getBunxCommandTarget(["--verbose"])) .toBeNull();

    expect(hasExplicitPackageVersion("eslint@9")).toBe(true);
    expect(hasExplicitPackageVersion("@scope/pkg@1.2.3")).toBe(true);
    expect(hasExplicitPackageVersion("@scope/pkg")).toBe(false);

    expect(isBunxCommandAvailable(["eslint"], new Set(["eslint"])) ).toBe(true);
    expect(isBunxCommandAvailable(["@scope/pkg@2"], new Set())).toBe(true);
    expect(isBunxCommandAvailable(["missing"], new Set())).toBe(false);
  });

  test("createProcessEnv preserves process env defaults and strips NO_COLOR", () => {
    const env = createProcessEnv({ CUSTOM_TEST_KEY: "ok" });

    expect(env.FORCE_COLOR).toBeDefined();
    expect(env.NODE_NO_WARNINGS).toBeDefined();
    expect(env.CUSTOM_TEST_KEY).toBe("ok");
    expect("NO_COLOR" in env).toBe(false);
  });

  test("getPreflightFailure returns not-found for unavailable commands", () => {
    const bunxFailure = getPreflightFailure("bunx", ["missing-tool"], new Set());
    const cmdFailure = getPreflightFailure("definitely-not-a-real-command-xyz", [], new Set());

    expect(bunxFailure?.notFound).toBe(true);
    expect(bunxFailure?.exitCode).toBe(127);
    expect(bunxFailure?.output).toContain("command not found");

    expect(cmdFailure?.notFound).toBe(true);
    expect(cmdFailure?.exitCode).toBe(127);
  });
});

describe("process collectors/io", () => {
  test("createProcessCollectors handles missing streams and flushCollectors resolves", async () => {
    const collectors = createProcessCollectors({ stderr: null, stdout: null });
    const didFlush = await flushCollectors(
      [collectors.stdoutCollector, collectors.stderrCollector],
      10,
    );

    expect(didFlush).toBe(true);
    expect(collectors.stdoutCollector.getOutput()).toBe("");
    expect(collectors.stderrCollector.getOutput()).toBe("");
  });

  test("buildCompletedCommand joins collected output", async () => {
    const collectors = {
      stderrCollector: { done: Promise.resolve(), getOutput: () => "err" },
      stdoutCollector: { done: Promise.resolve(), getOutput: () => "out" },
    };

    const command = await buildCompletedCommand(collectors, 0, Date.now() - 5);
    expect(command.exitCode).toBe(0);
    expect(command.timedOut).toBe(false);
    expect(command.output).toBe("outerr");
  });

  test("waitForProcessOutcome resolves exit and timeout branches", async () => {
    const exited = await waitForProcessOutcome({
      exited: Promise.resolve(0),
      kill: () => {},
    });
    expect(exited.kind).toBe("exit");
    if (exited.kind === "exit") {
      expect(exited.exitCode).toBe(0);
    }

    const timedOut = await waitForProcessOutcome(
      {
        exited: new Promise((resolve) => {
          setTimeout(() => resolve(0), 50);
        }),
        kill: () => {},
      },
      1,
    );
    expect(timedOut.kind).toBe("timeout");
  });
});

describe("withMissingDetection", () => {
  test("does not classify generic cannot-find-module/package output as missing", () => {
    const moduleResult = withMissingDetection({
      exitCode: 1,
      output: "Cannot find module './src/ui/Particles.tsx'\n",
      timedOut: false,
    });
    const packageResult = withMissingDetection({
      exitCode: 1,
      output: "cannot find package 'some-tool'\n",
      timedOut: false,
    });

    expect(moduleResult.notFound).toBeUndefined();
    expect(packageResult.notFound).toBeUndefined();
  });

  test("classifies command-not-found output as missing", () => {
    const result = withMissingDetection({
      exitCode: 127,
      output: "bash: semgrep: command not found:\n",
      timedOut: false,
    });

    expect(result.notFound).toBe(true);
  });
});
