import type { Command, StepConfig, StepPostProcessResult } from "./types.ts";

import { runStepPostProcess } from "./post-process.ts";
import { applyOutputFilter } from "./process.ts";
import { runStepBatch } from "./suite-batch.ts";
import { buildSummary } from "./summary.ts";
import { hasDeadlineExpired } from "./timeout.ts";

export interface CheckRow {
  d: string;
  k: string;
  ms?: number;
  status: "fail" | "pass";
  stpk: null | string;
}

export interface ProcessedResultEntry {
  displayOutput: string;
  postProcess: null | StepPostProcessResult;
}

export interface SuiteExecutionState {
  allExecutedSteps: StepConfig[];
  executedMainSteps: StepConfig[];
  runs: Record<string, Command>;
  suiteExpiredBeforeOutput: boolean;
  timedOut: boolean;
}

export function buildCheckRows(
  executedMainSteps: StepConfig[],
  runs: Record<string, Command>,
  processedResults: Record<string, ProcessedResultEntry>,
): CheckRow[] {
  return executedMainSteps.flatMap((step) => {
    const cmd = runs[step.key];
    const processed = processedResults[step.key].postProcess;
    const stepCheck: CheckRow = {
      d: processed?.summary ?? buildSummary(step, cmd),
      k: step.label,
      ms: cmd.durationMs,
      status: processed?.status ?? (cmd.exitCode === 0 ? "pass" : "fail"),
      stpk: step.key,
    };
    const extraChecks = (processed?.extraChecks ?? []).map((check) => ({
      d: check.details,
      k: check.label,
      status: check.status,
      stpk: null,
    }));
    return [stepCheck, ...extraChecks];
  });
}

export async function buildProcessedResults(
  allExecutedSteps: StepConfig[],
  runs: Record<string, Command>,
  suiteExpiredBeforeOutput: boolean,
): Promise<Record<string, ProcessedResultEntry>> {
  const entries = await Promise.all(
    allExecutedSteps.map(
      async (step) =>
        [
          step.key,
          {
            displayOutput: getStepDisplayOutput(step, runs[step.key].output),
            postProcess: suiteExpiredBeforeOutput
              ? null
              : await runStepPostProcess(
                  step,
                  runs[step.key],
                  getStepDisplayOutput(step, runs[step.key].output),
                ),
          },
        ] as const,
    ),
  );

  return Object.fromEntries(entries);
}

export function collectMissingSteps(
  allExecutedSteps: StepConfig[],
  runs: Record<string, Command>,
): string[] {
  return allExecutedSteps
    .filter((step) => runs[step.key].notFound)
    .map((step) => step.label);
}

export async function executeSuiteSteps(
  preRunSteps: StepConfig[],
  mainSteps: StepConfig[],
  deadlineMs: number,
): Promise<SuiteExecutionState> {
  const preRunResults = await runStepBatch(preRunSteps, deadlineMs);
  const preRunTimedOut = didAnyStepTimeOut(preRunResults);
  const suiteExpiredBeforeMain = shouldStopBeforeMainSteps(
    preRunTimedOut,
    deadlineMs,
  );
  const executedMainSteps =
    preRunTimedOut || suiteExpiredBeforeMain ? [] : mainSteps;
  const mainResults = await runSelectedMainSteps(
    executedMainSteps,
    mainSteps,
    deadlineMs,
  );
  const runs = { ...preRunResults, ...mainResults };
  const suiteExpiredBeforeOutput = shouldExpireBeforeOutput(
    preRunTimedOut,
    suiteExpiredBeforeMain,
    deadlineMs,
  );

  return {
    allExecutedSteps: [...preRunSteps, ...executedMainSteps],
    executedMainSteps,
    runs,
    suiteExpiredBeforeOutput,
    timedOut: didSuiteTimeOut(
      runs,
      suiteExpiredBeforeMain,
      suiteExpiredBeforeOutput,
    ),
  };
}

export async function prepareSuiteReport(
  executionState: SuiteExecutionState,
): Promise<{
  checks: CheckRow[];
  missingSteps: string[];
  processedResults: Record<string, ProcessedResultEntry>;
}> {
  const processedResults = await buildProcessedResults(
    executionState.allExecutedSteps,
    executionState.runs,
    executionState.suiteExpiredBeforeOutput,
  );

  return {
    checks: buildCheckRows(
      executionState.executedMainSteps,
      executionState.runs,
      processedResults,
    ),
    missingSteps: collectMissingSteps(
      executionState.allExecutedSteps,
      executionState.runs,
    ),
    processedResults,
  };
}

export function selectSuiteSteps(
  steps: StepConfig[],
  keyFilter: null | Set<string> | undefined,
  excludedKeys: ReadonlySet<string>,
): { mainSteps: StepConfig[]; preRunSteps: StepConfig[] } {
  return {
    mainSteps: steps.filter(
      (step) =>
        !step.preRun &&
        step.enabled !== false &&
        !excludedKeys.has(step.key) &&
        (!keyFilter || keyFilter.has(step.key)),
    ),
    preRunSteps: keyFilter
      ? []
      : steps.filter(
          (step) =>
            step.preRun &&
            step.enabled !== false &&
            !excludedKeys.has(step.key),
        ),
  };
}

function didAnyStepTimeOut(runs: Record<string, Command>): boolean {
  return Object.values(runs).some((result) => result.timedOut);
}

function didSuiteTimeOut(
  runs: Record<string, Command>,
  suiteExpiredBeforeMain: boolean,
  suiteExpiredBeforeOutput: boolean,
): boolean {
  return (
    suiteExpiredBeforeMain ||
    suiteExpiredBeforeOutput ||
    didAnyStepTimeOut(runs)
  );
}

function getStepDisplayOutput(step: StepConfig, output: string): string {
  return step.outputFilter
    ? applyOutputFilter(step.outputFilter, output)
    : output;
}

async function runSelectedMainSteps(
  executedMainSteps: StepConfig[],
  mainSteps: StepConfig[],
  deadlineMs: number,
): Promise<Record<string, Command>> {
  return executedMainSteps.length === mainSteps.length
    ? runStepBatch(mainSteps, deadlineMs)
    : {};
}

function shouldExpireBeforeOutput(
  preRunTimedOut: boolean,
  suiteExpiredBeforeMain: boolean,
  deadlineMs: number,
): boolean {
  return (
    !preRunTimedOut && !suiteExpiredBeforeMain && hasDeadlineExpired(deadlineMs)
  );
}

function shouldStopBeforeMainSteps(
  preRunTimedOut: boolean,
  deadlineMs: number,
): boolean {
  return !preRunTimedOut && hasDeadlineExpired(deadlineMs);
}
