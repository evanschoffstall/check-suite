import { access, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { failRelease, logRelease, runStepOrExit } from "./runtime.ts";

interface ReleaseSnapshot {
  cleanup: () => Promise<void>;
  path: string;
}

/**
 * Run the repository check suite against the current git index so unstaged
 * local edits cannot change the CI/CD decision.
 */
export async function runBunCheckAgainstIndexSnapshot(): Promise<void> {
  const snapshot = await createIndexSnapshot();

  try {
    logRelease(`Running bun check in staged snapshot ${snapshot.path}`);
    await runStepOrExit(
      {
        command: ["bun", "check"],
        label: "Run bun check for the staged snapshot",
      },
      { cwd: snapshot.path },
    );
  } finally {
    await snapshot.cleanup();
  }
}

/**
 * Materialize the current git index into an isolated temporary directory so
 * validation reads the staged snapshot instead of the mutable worktree.
 */
async function createIndexSnapshot(): Promise<ReleaseSnapshot> {
  const snapshotPath = await mkdtemp(join(tmpdir(), "check-suite-cicd-"));

  try {
    await runStepOrExit({
      command: ["git", "checkout-index", "--all", `--prefix=${snapshotPath}/`],
      label: "Materialize the staged snapshot",
    });
    await linkNodeModulesIntoSnapshot(snapshotPath);
  } catch (error_) {
    await rm(snapshotPath, { force: true, recursive: true });
    throw error_;
  }

  return {
    cleanup: async (): Promise<void> => {
      await rm(snapshotPath, { force: true, recursive: true });
    },
    path: snapshotPath,
  };
}

/**
 * Reuse the repository dependency tree inside the isolated snapshot so staged
 * validation does not reinstall packages on each run.
 */
async function linkNodeModulesIntoSnapshot(snapshotPath: string): Promise<void> {
  const nodeModulesPath = join(process.cwd(), "node_modules");

  try {
    await access(nodeModulesPath);
  } catch {
    failRelease(
      "node_modules is required for staged CI/CD validation. Install dependencies before continuing.",
    );
  }

  await symlink(nodeModulesPath, join(snapshotPath, "node_modules"), "dir");
}