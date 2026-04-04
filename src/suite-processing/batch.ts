import type { Command, StepConfig } from "../types/index.ts";

import { runStepWithinDeadline } from "../step/index.ts";

/** Runs a batch in config order while refusing to start steps after the deadline. */
export async function runStepBatch(
  steps: StepConfig[],
  deadlineMs: number,
): Promise<Record<string, Command>> {
  const groupedSteps = groupStepsBySerialMode(steps);
  const tasks = [
    ...groupedSteps.ungrouped.map((step) =>
      runStepWithinDeadline(step, deadlineMs).then((cmd) => [
        [step.key, cmd] as const,
      ]),
    ),
    ...[...groupedSteps.serialGroups.values()].map((groupSteps) =>
      runSerialGroup(groupSteps, deadlineMs),
    ),
  ];

  return Object.fromEntries((await Promise.all(tasks)).flat()) as Record<
    string,
    Command
  >;
}

function groupStepsBySerialMode(steps: StepConfig[]): {
  serialGroups: Map<string, StepConfig[]>;
  ungrouped: StepConfig[];
} {
  const serialGroups = new Map<string, StepConfig[]>();
  const ungrouped: StepConfig[] = [];

  for (const step of steps) {
    if (!step.serialGroup) {
      ungrouped.push(step);
      continue;
    }

    const group = serialGroups.get(step.serialGroup) ?? [];
    group.push(step);
    serialGroups.set(step.serialGroup, group);
  }

  return { serialGroups, ungrouped };
}

async function runSerialGroup(
  steps: StepConfig[],
  deadlineMs: number,
): Promise<(readonly [string, Command])[]> {
  const groupResults: (readonly [string, Command])[] = [];

  for (const step of steps) {
    groupResults.push([
      step.key,
      await runStepWithinDeadline(step, deadlineMs),
    ]);
  }

  return groupResults;
}
