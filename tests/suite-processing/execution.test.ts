import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

import type { Command, StepConfig } from "@/types/index.ts";

afterEach(() => {
  mock.restore();
});

afterAll(() => {
  mock.restore();
});

describe("executeSuiteSteps", () => {
  test("skips main steps after a pre-run timeout", async () => {
    const batchCalls: StepConfig[][] = [];

    mock.module("@/suite-processing/batch.ts", () => ({
      runStepBatch: async (steps: StepConfig[]): Promise<Record<string, Command>> => {
        batchCalls.push(steps);
        return {
          preflight: {
            exitCode: 124,
            output: "preflight exceeded the 1ms timeout\n",
            timedOut: true,
          },
        };
      },
    }));
    mock.module("@/timeout/index.ts", () => ({
      hasDeadlineExpired: (): boolean => false,
    }));

    const { executeSuiteSteps } = await import("@/suite-processing/execution.ts");
    const preRunStep: StepConfig = {
      key: "preflight",
      label: "preflight",
      preRun: true,
    };
    const mainStep: StepConfig = {
      key: "lint",
      label: "lint",
    };

    const executionState = await executeSuiteSteps(
      [preRunStep],
      [mainStep],
      Date.now() + 5_000,
    );

    expect(batchCalls).toEqual([[preRunStep]]);
    expect(executionState.executedMainSteps).toEqual([]);
    expect(executionState.allExecutedSteps.map((step) => step.key)).toEqual([
      "preflight",
    ]);
    expect(executionState.runs.preflight.timedOut).toBe(true);
    expect(executionState.timedOut).toBe(true);
    expect(executionState.suiteExpiredBeforeOutput).toBe(false);
  });
});