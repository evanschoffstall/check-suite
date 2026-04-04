import type { Command, StepConfig } from "./types.ts";

import { CFG, SUITE_LABEL, SUITE_TIMEOUT_MS } from "./config.ts";
import {
  ANSI,
  divider,
  paint,
  printPostProcessMessages,
  printPostProcessSections,
  printStepOutput,
  row,
} from "./format.ts";
import { runStepPostProcess } from "./post-process.ts";
import { applyOutputFilter } from "./process.ts";
import { runStepWithinDeadline } from "./step.ts";
import { buildSummary } from "./summary.ts";
import { hasDeadlineExpired } from "./timeout.ts";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CheckRow {
  d: string;
  k: string;
  ms?: number;
  status: "fail" | "pass";
  /** Key of the originating step, or `null` for extra checks. */
  stpk: null | string;
}

// ---------------------------------------------------------------------------
// Suite runner
// ---------------------------------------------------------------------------

/** Runs the configured quality suite with optional step filtering and summary mode. */
export async function runCheckSuite(
  keyFilter?: null | Set<string>,
  options: { excludedKeys?: ReadonlySet<string>; summaryOnly?: boolean } = {},
): Promise<void> {
  const startedAtMs = Date.now();
  const deadlineMs = startedAtMs + SUITE_TIMEOUT_MS;
  const excludedKeys = options.excludedKeys ?? new Set<string>();
  const summaryOnly = options.summaryOnly === true;

  if (!summaryOnly) {
    process.stdout.write(paint("⏳ Please wait ... ", ANSI.bold, ANSI.cyan));
  }

  const preRunSteps = keyFilter
    ? []
    : CFG.steps.filter(
        (s) => s.preRun && s.enabled !== false && !excludedKeys.has(s.key),
      );
  const mainSteps = CFG.steps.filter(
    (s) =>
      !s.preRun &&
      s.enabled !== false &&
      !excludedKeys.has(s.key) &&
      (!keyFilter || keyFilter.has(s.key)),
  );

  const preRunResults = await runStepBatch(preRunSteps, deadlineMs);
  const preRunTimedOut = Object.values(preRunResults).some(
    (result) => result.timedOut,
  );
  const suiteExpiredBeforeMain =
    !preRunTimedOut && hasDeadlineExpired(deadlineMs);
  const executedMainSteps =
    preRunTimedOut || suiteExpiredBeforeMain ? [] : mainSteps;
  const mainResults =
    preRunTimedOut || suiteExpiredBeforeMain
      ? {}
      : await runStepBatch(mainSteps, deadlineMs);

  const runs = { ...preRunResults, ...mainResults };
  const suiteExpiredBeforeOutput =
    !preRunTimedOut &&
    !suiteExpiredBeforeMain &&
    hasDeadlineExpired(deadlineMs);
  const timedOut =
    suiteExpiredBeforeMain ||
    suiteExpiredBeforeOutput ||
    Object.values(runs).some((result) => result.timedOut);

  const allExecutedSteps = [...preRunSteps, ...executedMainSteps];
  const missingSteps = allExecutedSteps
    .filter((step) => runs[step.key].notFound)
    .map((s) => s.label);

  const processedResults = suiteExpiredBeforeOutput
    ? Object.fromEntries(
        allExecutedSteps.map((step) => {
          const filteredOutput = step.outputFilter
            ? applyOutputFilter(step.outputFilter, runs[step.key].output)
            : runs[step.key].output;
          return [
            step.key,
            { displayOutput: filteredOutput, postProcess: null },
          ] as const;
        }),
      )
    : Object.fromEntries(
        await Promise.all(
          allExecutedSteps.map(async (step) => {
            const filteredOutput = step.outputFilter
              ? applyOutputFilter(step.outputFilter, runs[step.key].output)
              : runs[step.key].output;
            return [
              step.key,
              {
                displayOutput: filteredOutput,
                postProcess: await runStepPostProcess(
                  step,
                  runs[step.key],
                  filteredOutput,
                ),
              },
            ] as const;
          }),
        ),
      );

  if (!summaryOnly && !suiteExpiredBeforeOutput) {
    for (const step of allExecutedSteps) {
      if (runs[step.key].notFound) continue;
      const postProcessedOutput = processedResults[step.key].postProcess?.output;
      const displayOutput =
        postProcessedOutput ?? processedResults[step.key].displayOutput;
      printStepOutput(step.label, displayOutput);
    }
  }

  const checks: CheckRow[] = executedMainSteps.flatMap((step) => {
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

  if (!summaryOnly) {
    if (suiteExpiredBeforeOutput) {
      console.info(
        `\n${paint("Suite deadline reached before detailed output; skipping step output and post-processing.", ANSI.bold, ANSI.yellow)}`,
      );
    }

    for (const step of executedMainSteps) {
      if (suiteExpiredBeforeOutput) break;
      const processed = processedResults[step.key].postProcess;
      if (processed?.messages?.length) {
        printPostProcessMessages(processed.messages);
      }
      if (processed?.sections?.length) {
        printPostProcessSections(processed.sections);
      }
    }

    if (missingSteps.length > 0)
      console.info(
        `\n${paint("missing/not found:", ANSI.bold, ANSI.yellow)} ${paint(missingSteps.join(", "), ANSI.yellow)}`,
      );
  }

  const presentChecks = checks.filter(
    (c) => !c.stpk || !runs[c.stpk].notFound,
  );

  console.info(`\n${paint("Quality Summary", ANSI.bold, ANSI.cyan)}`);
  console.info(divider());
  for (const check of presentChecks)
    console.info(row(check.k, check.status, check.d, check.ms));
  console.info(divider());

  const allOk = presentChecks.every((c) => c.status !== "fail") && !timedOut;
  const elapsedSeconds = ((Date.now() - startedAtMs) / 1000).toFixed(2);
  console.info(
    row(
      "Overall",
      allOk ? "pass" : "fail",
      `${allOk ? "all checks passed" : "one or more checks failed"} (in ${elapsedSeconds} seconds)`,
    ),
  );
  console.info(divider());

  if (timedOut) {
    console.error(
      `Check command failed: ${SUITE_LABEL} exceeded the ${(SUITE_TIMEOUT_MS / 1000).toFixed(2)}-second overall timeout. Please try again.`,
    );
    process.exit(1);
  }
  if (!allOk) process.exit(1);
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

/** Runs a batch in config order while refusing to start steps after the deadline. */
export async function runStepBatch(
  steps: StepConfig[],
  deadlineMs: number,
): Promise<Record<string, Command>> {
  // Group steps: steps sharing a serialGroup run sequentially within their
  // group, but all groups (and ungrouped steps) run concurrently.
  const serialGroups = new Map<string, StepConfig[]>();
  const ungrouped: StepConfig[] = [];

  for (const step of steps) {
    if (step.serialGroup) {
      const group = serialGroups.get(step.serialGroup) ?? [];
      group.push(step);
      serialGroups.set(step.serialGroup, group);
    } else {
      ungrouped.push(step);
    }
  }

  const tasks: Promise<(readonly [string, Command])[]>[] = [];

  for (const step of ungrouped) {
    tasks.push(
      runStepWithinDeadline(step, deadlineMs).then((cmd) => [
        [step.key, cmd] as const,
      ]),
    );
  }

  for (const groupSteps of serialGroups.values()) {
    tasks.push(
      (async () => {
        const groupResults: (readonly [string, Command])[] = [];
        for (const step of groupSteps) {
          groupResults.push([
            step.key,
            await runStepWithinDeadline(step, deadlineMs),
          ]);
        }
        return groupResults;
      })(),
    );
  }

  const settled = await Promise.all(tasks);
  return Object.fromEntries(settled.flat()) as Record<string, Command>;
}
