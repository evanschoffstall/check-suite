import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

import {
  askYesNo,
  failRelease,
  logRelease,
  runCommand,
  runStepOrExit,
} from "./runtime.ts";

const MAIN_BRANCH = "main";
const CICD_LOCK_NAME = "check-suite-cicd.lock";

export interface ReleaseLock {
  release: () => Promise<void>;
}

/**
 * Serialize CI/CD executions without blocking unrelated editors or agents that
 * are only reading files.
 */
export async function acquireReleaseLock(): Promise<ReleaseLock> {
  const gitDirectory = await getGitDirectory();
  const lockDirectoryPath = join(process.cwd(), gitDirectory, CICD_LOCK_NAME);
  const metadataPath = join(lockDirectoryPath, "metadata.json");

  try {
    await mkdir(lockDirectoryPath);
  } catch (error_) {
    if (
      error_ instanceof Error &&
      "code" in error_ &&
      error_.code === "EEXIST"
    ) {
      if (await releaseLockIsStale(metadataPath)) {
        await rm(lockDirectoryPath, { force: true, recursive: true });
        await mkdir(lockDirectoryPath);
        logRelease(`Recovered stale CI/CD lock at ${lockDirectoryPath}.`);
        return buildReleaseLock(lockDirectoryPath, metadataPath);
      } else {
        failRelease(
          `Another CI/CD run already holds ${lockDirectoryPath}. Remove it only after confirming the previous process is gone.`,
        );
      }
    }

    throw error_;
  }

  return buildReleaseLock(lockDirectoryPath, metadataPath);
}

/**
 * Offer to create a conventional commit via gitaicmt when the worktree is
 * dirty so the workflow can safely push an exact release candidate revision.
 */
export async function commitPendingChangesIfRequested(): Promise<void> {
  if (!(await hasPendingChanges())) {
    return;
  }

  if (!(await hasStagedChanges())) {
    failRelease(
      "Dirty worktree detected with no staged release candidate. Stage the exact release changes first so staged-only validation does not diverge from the eventual commit.",
    );
  }

  logRelease("Pending changes detected.");

  const shouldCommitChanges = await askYesNo(
    "Run gitaicmt --no-token-check -y before continuing? (y/n) ",
  );
  if (!shouldCommitChanges) {
    failRelease("CI/CD flow cancelled because the worktree is not clean.");
  }

  await runStepOrExit({
    command: ["gitaicmt", "--no-token-check", "-y"],
    label: "Create commit with gitaicmt",
  });

  await ensureCleanWorkingTree();
}

/**
 * Ensure the worktree stays clean after the optional auto-commit step so the
 * workflow runs against one stable revision.
 */
export async function ensureCleanWorkingTree(): Promise<void> {
  if (await hasPendingChanges()) {
    failRelease(
      "CI/CD flow requires a clean worktree. Commit, stash, or discard changes before continuing.",
    );
  }
}

/**
 * Confirm that local HEAD and origin/main point at the same commit after the
 * push step so an unpublished local commit cannot be released accidentally.
 */
export async function ensureHeadMatchesOriginMain(): Promise<string> {
  await runStepOrExit({
    command: ["git", "fetch", "origin", MAIN_BRANCH],
    label: `Fetch origin/${MAIN_BRANCH}`,
  });

  const [headRevision, remoteRevision] = await Promise.all([
    runCommandForStdout(
      ["git", "rev-parse", "HEAD"],
      "Unable to resolve local HEAD",
    ),
    runCommandForStdout(
      ["git", "rev-parse", `refs/remotes/origin/${MAIN_BRANCH}`],
      `Unable to resolve origin/${MAIN_BRANCH}`,
    ),
  ]);

  if (headRevision !== remoteRevision) {
    failRelease(
      `Local HEAD (${headRevision}) does not match origin/${MAIN_BRANCH} (${remoteRevision}). Push or reconcile before continuing.`,
    );
  }

  return headRevision;
}

/**
 * Ensure the workflow runs only from the canonical main branch.
 */
export async function ensureOnMainBranch(): Promise<void> {
  const branchName = await getCurrentBranchName();
  if (branchName !== MAIN_BRANCH) {
    failRelease(
      `CI/CD flow must start on ${MAIN_BRANCH}. Current branch is ${branchName}.`,
    );
  }
}

/**
 * Refuse to continue if another process changed the checked-out revision after
 * the dry-run completed.
 */
export async function ensureReleaseRevisionUnchanged(
  expectedRevision: string,
): Promise<void> {
  const currentRevision = await runCommandForStdout(
    ["git", "rev-parse", "HEAD"],
    "Unable to resolve the current revision",
  );

  if (currentRevision !== expectedRevision) {
    failRelease(
      `HEAD changed during the CI/CD workflow (${expectedRevision} -> ${currentRevision}). Restart from a stable state.`,
    );
  }
}

/**
 * Push the current main revision before the optional publish step so
 * semantic-release runs against exactly what already exists on origin.
 */
export async function pushMainBranch(): Promise<void> {
  await runStepOrExit({
    command: ["git", "push", "origin", MAIN_BRANCH],
    label: `Push ${MAIN_BRANCH} to origin`,
  });
}

/**
 * Prompt for explicit confirmation before running the optional publish step.
 */
export async function shouldProceedWithRelease(): Promise<boolean> {
  logRelease("Dry-run checks completed.");
  return await askYesNo("Publish the release now? (y/n) ");
}

/**
 * Persist lock metadata and return the matching cleanup callback.
 */
async function buildReleaseLock(
  lockDirectoryPath: string,
  metadataPath: string,
): Promise<ReleaseLock> {
  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        acquiredAt: new Date().toISOString(),
        pid: process.pid,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    release: async (): Promise<void> => {
      await rm(lockDirectoryPath, { force: true, recursive: true });
    },
  };
}

/**
 * Return the current branch name and fail when the repository is detached.
 */
async function getCurrentBranchName(): Promise<string> {
  const branchName = await runCommandForStdout(
    ["git", "rev-parse", "--abbrev-ref", "HEAD"],
    "Unable to determine the current branch",
  );

  if (branchName === "HEAD") {
    failRelease("CI/CD flow must run from a named branch, not detached HEAD.");
  }

  return branchName;
}

/**
 * Resolve the real git directory so the workflow lock works for both normal
 * clones and dedicated git worktrees.
 */
async function getGitDirectory(): Promise<string> {
  return await runCommandForStdout(
    ["git", "rev-parse", "--git-dir"],
    "Unable to resolve the git directory",
  );
}

/**
 * Detect whether the worktree has any staged, unstaged, or untracked changes.
 */
async function hasPendingChanges(): Promise<boolean> {
  const statusOutput = await runCommandForStdout(
    ["git", "status", "--porcelain"],
    "Unable to inspect the git worktree",
  );

  return statusOutput.length > 0;
}

/**
 * Detect whether the index contains staged changes beyond the current HEAD.
 */
async function hasStagedChanges(): Promise<boolean> {
  const stagedOutput = await runCommandForStdout(
    ["git", "diff", "--cached", "--name-only"],
    "Unable to inspect staged release changes",
  );

  return stagedOutput.length > 0;
}

/**
 * Treat a lock as stale when its recorded process no longer exists.
 */
async function releaseLockIsStale(metadataPath: string): Promise<boolean> {
  try {
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {
      pid?: number;
    };

    if (typeof metadata.pid !== "number") {
      return false;
    }

    try {
      process.kill(metadata.pid, 0);
      return false;
    } catch (error_) {
      if (
        error_ instanceof Error &&
        "code" in error_ &&
        error_.code === "ESRCH"
      ) {
        return true;
      }

      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Run a command that must succeed and return its trimmed stdout.
 */
async function runCommandForStdout(
  command: readonly [string, ...string[]],
  failureLabel: string,
): Promise<string> {
  const result = await runCommand(command, "capture");
  if (result.exitCode !== 0) {
    const stderr = result.stderr.trim();
    failRelease(
      stderr.length > 0
        ? `${failureLabel}: ${stderr}`
        : `${failureLabel}: command exited with ${result.exitCode}.`,
    );
  }

  return result.stdout.trim();
}
