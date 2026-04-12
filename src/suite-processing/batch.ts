import type { Command, StepConfig } from "@/types/index.ts";

import { stripAnsi } from "@/format/index.ts";
import { runStepWithinDeadline } from "@/step/index.ts";

export interface ActiveSuiteStepStatus {
  label: string;
  output: string;
}

/** Runs a batch in config order while refusing to start steps after the deadline. */
export async function runStepBatch(
  steps: StepConfig[],
  deadlineMs: number,
  options: {
    onActiveStepChange?: (step: ActiveSuiteStepStatus | null) => void;
  } = {},
): Promise<Record<string, Command>> {
  const groupedSteps = groupStepsBySerialMode(steps);
  const progressTracker = createActiveStepProgressTracker(
    steps,
    options.onActiveStepChange,
  );
  const tasks = [
    ...groupedSteps.ungrouped.map((step) =>
      runTrackedStep(step, deadlineMs, progressTracker),
    ),
    ...[...groupedSteps.serialGroups.values()].map((groupSteps) =>
      runSerialGroup(groupSteps, deadlineMs, progressTracker),
    ),
  ];

  return Object.fromEntries((await Promise.all(tasks)).flat()) as Record<
    string,
    Command
  >;
}

function createActiveStepProgressTracker(
  steps: StepConfig[],
  onActiveStepChange?: (step: ActiveSuiteStepStatus | null) => void,
): {
  completeStep: (step: StepConfig) => void;
  startStep: (step: StepConfig) => void;
  updateStepOutput: (step: StepConfig, output: string) => void;
} {
  const activeSteps = new Map<string, string>();
  let lastVisibleStatus: ActiveSuiteStepStatus | null = null;
  let lastEmittedSignature = "";

  const emitActiveStep = (): void => {
    const activeStatuses = steps
      .filter((step) => activeSteps.has(step.key))
      .map((step) => ({
        label: step.label,
        output: extractLastOutputLine(activeSteps.get(step.key) ?? ""),
      }));

    if (activeStatuses.length === 0) {
      lastVisibleStatus = null;
      if (lastEmittedSignature === "__empty__") {
        return;
      }
      lastEmittedSignature = "__empty__";
      onActiveStepChange?.(null);
      return;
    }

    const firstVisibleStatus = activeStatuses.find((step) => step.output.length > 0);
    if (firstVisibleStatus) {
      lastVisibleStatus = firstVisibleStatus;
    }

    const status = firstVisibleStatus ?? lastVisibleStatus;
    if (!status) {
      return;
    }

    const nextSignature = `${status.label}\u0000${status.output}`;
    if (lastEmittedSignature === nextSignature) {
      return;
    }
    lastEmittedSignature = nextSignature;
    onActiveStepChange?.(status);
  };

  return {
    completeStep(step): void {
      activeSteps.delete(step.key);
      emitActiveStep();
    },
    startStep(step): void {
      activeSteps.set(step.key, "");
      emitActiveStep();
    },
    updateStepOutput(step, output): void {
      if (!activeSteps.has(step.key)) {
        return;
      }
      activeSteps.set(step.key, output);
      emitActiveStep();
    },
  };
}

function extractLastOutputLine(output: string): string {
  const sanitizedLines = stripAnsi(output)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return sanitizedLines.at(-1) ?? "";
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
  progressTracker: ReturnType<typeof createActiveStepProgressTracker>,
): Promise<(readonly [string, Command])[]> {
  const groupResults: (readonly [string, Command])[] = [];

  for (const step of steps) {
    groupResults.push(
      ...(await runTrackedStep(step, deadlineMs, progressTracker)),
    );
  }

  return groupResults;
}

async function runTrackedStep(
  step: StepConfig,
  deadlineMs: number,
  progressTracker: ReturnType<typeof createActiveStepProgressTracker>,
): Promise<(readonly [string, Command])[]> {
  progressTracker.startStep(step);

  try {
    const command = await runStepWithinDeadline(
      step,
      deadlineMs,
      [],
      (output) => {
        progressTracker.updateStepOutput(step, output);
      },
    );

    return [[step.key, command] as const];
  } finally {
    progressTracker.completeStep(step);
  }
}
