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
});