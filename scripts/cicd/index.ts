/// <reference types="bun" />

import process from "node:process";

import {
  acquireReleaseLock,
  commitPendingChangesIfRequested,
  ensureHeadMatchesOriginMain,
  ensureNoStagedChangesRemain,
  ensureOnMainBranch,
  ensureReleaseRevisionUnchanged,
  pushMainBranch,
  shouldProceedWithRelease,
  syncLocalMainWithOrigin,
} from "./git.ts";
import { logRelease, ReleaseWorkflowError } from "./runtime.ts";
import {
  runBunCheckAgainstIndexSnapshot,
  runStepAgainstHeadWorktree,
} from "./snapshot.ts";

/**
 * Run the guarded CI/CD workflow only after the staged candidate is validated
 * in isolation, committed, pushed, locked, and verified against origin/main.
 *
 * The optional final publish step only runs after an explicit confirmation, and
 * post-commit release commands execute from a detached HEAD worktree so
 * unrelated local edits cannot affect the result.
 */
async function main(): Promise<void> {
  const releaseLock = await acquireReleaseLock();

  try {
    await ensureOnMainBranch();
    await runBunCheckAgainstIndexSnapshot();
    await commitPendingChangesIfRequested();
    await ensureNoStagedChangesRemain();
    await pushMainBranch();

    const releaseRevision = await ensureHeadMatchesOriginMain();

    await runStepAgainstHeadWorktree({
      command: ["bunx", "semantic-release", "--no-ci", "--dry-run"],
      label: "Run semantic-release dry-run",
    });

    if (!(await shouldProceedWithRelease())) {
      logRelease("Publish step skipped by user.");
      return;
    }

    await ensureReleaseRevisionUnchanged(releaseRevision);
    await ensureHeadMatchesOriginMain();
    await runStepAgainstHeadWorktree({
      command: ["bunx", "semantic-release", "--no-ci"],
      label: "Run semantic-release",
    });
    await syncLocalMainWithOrigin();
  } finally {
    await releaseLock.release();
  }
}

try {
  await main();
} catch (error_) {
  if (error_ instanceof ReleaseWorkflowError) {
    process.exitCode = error_.exitCode;
  } else {
    throw error_;
  }
}
