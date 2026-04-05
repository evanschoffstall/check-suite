/// <reference types="bun" />

import {
  acquireReleaseLock,
  commitPendingChangesIfRequested,
  ensureCleanWorkingTree,
  ensureHeadMatchesOriginMain,
  ensureOnMainBranch,
  ensureReleaseRevisionUnchanged,
  pushMainBranch,
  shouldProceedWithRelease,
} from "./git.ts";
import { logRelease, runStepOrExit } from "./runtime.ts";
import { runBunCheckAgainstIndexSnapshot } from "./snapshot.ts";

/**
 * Run the guarded CI/CD workflow only after the staged candidate is validated
 * in isolation, committed, pushed, locked, and verified against origin/main.
 *
 * The optional final publish step only runs after an explicit confirmation.
 */
async function main(): Promise<void> {
  const releaseLock = await acquireReleaseLock();

  try {
    await ensureOnMainBranch();
    await runBunCheckAgainstIndexSnapshot();
    await commitPendingChangesIfRequested();
    await ensureCleanWorkingTree();
    await pushMainBranch();

    const releaseRevision = await ensureHeadMatchesOriginMain();

    await runStepOrExit({
      command: ["bunx", "semantic-release", "--no-ci", "--dry-run"],
      label: "Run semantic-release dry-run",
    });

    if (!(await shouldProceedWithRelease())) {
      logRelease("Publish step skipped by user.");
      return;
    }

    await ensureCleanWorkingTree();
    await ensureReleaseRevisionUnchanged(releaseRevision);
    await ensureHeadMatchesOriginMain();
    await runStepOrExit({
      command: ["bunx", "semantic-release", "--no-ci"],
      label: "Run semantic-release",
    });
  } finally {
    await releaseLock.release();
  }
}

await main();