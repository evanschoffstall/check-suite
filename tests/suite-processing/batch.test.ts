import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";

import type { Command, StepConfig } from "@/types/index.ts";

afterEach(() => {
  mock.restore();
});

afterAll(() => {
  mock.restore();
});

describe("runStepBatch", () => {
  test("keeps serial-group steps ordered while running ungrouped work alongside them", async () => {
    const events: string[] = [];

    mock.module("@/step/index.ts", () => ({
      runStepWithinDeadline: async (step: StepConfig): Promise<Command> => {
        if (step.key === "serial-one") {
          events.push("serial-one:start");
          await Bun.sleep(10);
          events.push("serial-one:end");
          return { exitCode: 0, output: "serial-one\n", timedOut: false };
        }

        if (step.key === "serial-two") {
          events.push("serial-two:start");
          return {
            exitCode: 0,
            output: `saw:${events.join(",")}\n`,
            timedOut: false,
          };
        }

        events.push("parallel:start");
        return { exitCode: 0, output: "parallel\n", timedOut: false };
      },
    }));

    const { runStepBatch } = await import("@/suite-processing/batch.ts");
    const runs = await runStepBatch(
      [
        {
          key: "serial-one",
          label: "serial-one",
          serialGroup: "checks",
        },
        {
          key: "parallel",
          label: "parallel",
        },
        {
          key: "serial-two",
          label: "serial-two",
          serialGroup: "checks",
        },
      ],
      Date.now() + 5_000,
    );

    expect(runs["serial-one"].exitCode).toBe(0);
    expect(runs.parallel.exitCode).toBe(0);
    expect(runs["serial-two"].exitCode).toBe(0);
    expect(events).toEqual([
      "parallel:start",
      "serial-one:start",
      "serial-one:end",
      "serial-two:start",
    ]);
    expect(runs["serial-two"].output).toContain("serial-one:end");
  });

  test("publishes the latest output line from the most recently updated active step", async () => {
    const activeSteps: (null | { label: string; output: string })[] = [];
    const firstStepGate = Promise.withResolvers<undefined>();
    const secondStepGate = Promise.withResolvers<undefined>();

    mock.module("@/step/index.ts", () => ({
      runStepWithinDeadline: async (
        step: StepConfig,
        _deadlineMs: number,
        _extraArgs: string[],
        onOutput?: (output: string) => void,
      ): Promise<Command> => {
        if (step.key === "first") {
          onOutput?.("booting\n");
          onOutput?.("booting\nready\n");
          await firstStepGate.promise;
          return { exitCode: 0, output: "booting\nready\n", timedOut: false };
        }

        onOutput?.("second line\n");
        await secondStepGate.promise;
        return { exitCode: 0, output: "second line\n", timedOut: false };
      },
    }));

    const { runStepBatch } = await import("@/suite-processing/batch.ts");
    const batchPromise = runStepBatch(
      [
        { key: "first", label: "first step" },
        { key: "second", label: "second step" },
      ],
      Date.now() + 5_000,
      {
        onActiveStepChange: (step) => {
          activeSteps.push(step);
        },
      },
    );

    await Bun.sleep(0);
    firstStepGate.resolve(undefined);
    await Bun.sleep(0);
    secondStepGate.resolve(undefined);
    await batchPromise;

    expect(activeSteps).toContainEqual({ label: "first step", output: "ready" });
    expect(activeSteps).toContainEqual({ label: "second step", output: "second line" });
    expect(activeSteps.at(-1)).toBeNull();
  });

  test("prefers newer active output over older active output", async () => {
    const activeSteps: (null | { label: string; output: string })[] = [];
    const firstStepGate = Promise.withResolvers<undefined>();
    const secondStepGate = Promise.withResolvers<undefined>();

    mock.module("@/step/index.ts", () => ({
      runStepWithinDeadline: async (
        step: StepConfig,
        _deadlineMs: number,
        _extraArgs: string[],
        onOutput?: (output: string) => void,
      ): Promise<Command> => {
        if (step.key === "first") {
          await firstStepGate.promise;
          onOutput?.("first line\n");
          return { exitCode: 0, output: "first line\n", timedOut: false };
        }

        onOutput?.("second line\n");
        await secondStepGate.promise;
        return { exitCode: 0, output: "second line\n", timedOut: false };
      },
    }));

    const { runStepBatch } = await import("@/suite-processing/batch.ts");
    const batchPromise = runStepBatch(
      [
        { key: "first", label: "first step" },
        { key: "second", label: "second step" },
      ],
      Date.now() + 5_000,
      {
        onActiveStepChange: (step) => {
          activeSteps.push(step);
        },
      },
    );

    await Bun.sleep(0);
    expect(activeSteps).toContainEqual({ label: "second step", output: "second line" });
    firstStepGate.resolve(undefined);
    await Bun.sleep(0);
    expect(activeSteps).toContainEqual({ label: "first step", output: "first line" });
    secondStepGate.resolve(undefined);
    await batchPromise;
  });

  test("clears completed step output when the remaining active steps are still silent", async () => {
    const activeSteps: (null | { label: string; output: string })[] = [];
    const firstStepGate = Promise.withResolvers<undefined>();
    const secondStepGate = Promise.withResolvers<undefined>();

    mock.module("@/step/index.ts", () => ({
      runStepWithinDeadline: async (
        step: StepConfig,
        _deadlineMs: number,
        _extraArgs: string[],
        onOutput?: (output: string) => void,
      ): Promise<Command> => {
        if (step.key === "first") {
          onOutput?.("alpha\n");
          await firstStepGate.promise;
          return { exitCode: 0, output: "alpha\n", timedOut: false };
        }

        await secondStepGate.promise;
        onOutput?.("beta\n");
        return { exitCode: 0, output: "beta\n", timedOut: false };
      },
    }));

    const { runStepBatch } = await import("@/suite-processing/batch.ts");
    const batchPromise = runStepBatch(
      [
        { key: "first", label: "first step" },
        { key: "second", label: "second step" },
      ],
      Date.now() + 5_000,
      {
        onActiveStepChange: (step) => {
          activeSteps.push(step);
        },
      },
    );

    await Bun.sleep(0);
    firstStepGate.resolve(undefined);
    await Bun.sleep(0);

    expect(activeSteps).not.toContainEqual({ label: "second step", output: "" });
    expect(activeSteps.at(-1)).toBeNull();

    secondStepGate.resolve(undefined);
    await batchPromise;
  });
});