/// <reference types="bun" />

import { randomUUID } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

const MAIN_BRANCH = "main";
const CICD_LOCK_NAME = "check-suite-cicd.lock";
type Command = readonly [string, ...string[]];
interface CommandResult { durationInMilliseconds: number; exitCode: number; stderr: string; stdout: string; }
interface MainBranchRevisionState { headRevision: string; remoteRevision: string; }
type MainBranchSyncAction = "continue" | "fail" | "fast-forward";
type MainBranchSyncPhase = "post-release" | "pre-release";
type OutputMode = "capture" | "inherit";
type ReleaseCandidatePreparationAction = "continue" | "use-clean-head" | "use-worktree";
interface ReleaseStep { command: Command; label: string; }
const conflictingFetchedTagPattern = /! \[rejected\]\s+([^\s]+)\s+->\s+\1\s+\(would clobber existing tag\)/iu;
const existingLocalTagPattern = /fatal: tag '([^']+)' already exists/iu;

/** Keep CI/CD deterministic while still prompting for explicit operator consent. */
class ReleaseWorkflowError extends Error {
  constructor(message: string, readonly exitCode = 1) {
    super(message);
    this.name = "ReleaseWorkflowError";
  }
}

const git = (...arguments_: [string, ...string[]]): Command => ["git", ...arguments_];
const logRelease = (message: string): void => console.info(`[cicd] ${message}`);
const failRelease = (message: string): never => { logRelease(message); throw new ReleaseWorkflowError(message); };

/** Resolve whether a command is available on the current PATH before prompting to use it. */
const hasCommandAvailable = async (commandName: string): Promise<boolean> => {
  const result = await runCommand(["bash", "-lc", `command -v -- ${JSON.stringify(commandName)}`], "capture");
  return result.exitCode === 0;
};

/** Keep pre-release validation strict while allowing the published release commit to advance origin/main. */
export function determineMainBranchSyncAction(phase: MainBranchSyncPhase, state: MainBranchRevisionState): MainBranchSyncAction {
  if (state.headRevision === state.remoteRevision) return "continue";
  return phase === "post-release" ? "fast-forward" : "fail";
}

/**
 * Decide whether release validation should use the staged index, use the
 * current worktree snapshot, or accept the already-committed clean HEAD as the
 * release candidate.
 */
export function determineReleaseCandidatePreparationAction(hasStagedReleaseCandidate: boolean, hasPendingWorktreeChanges: boolean): ReleaseCandidatePreparationAction {
  if (hasStagedReleaseCandidate) return "continue";
  return hasPendingWorktreeChanges ? "use-worktree" : "use-clean-head";
}

/**
 * Convert semantic-release's raw git-tag collision into an actionable operator
 * message so local tag state is fixed before the workflow retries.
 */
export function formatExistingLocalTagFailure(stderr: string): string | undefined {
  const conflictingFetchedTagMatch = conflictingFetchedTagPattern.exec(stderr);
  if (conflictingFetchedTagMatch) {
    const [, tagName] = conflictingFetchedTagMatch;
    return `semantic-release could not synchronize tag ${tagName} because the local tag points at a different object than origin. Force-refresh local tags from origin before releasing so semantic-release reads the canonical remote tag history.`;
  }
  const tagMatch = existingLocalTagPattern.exec(stderr);
  if (!tagMatch) return undefined;
  const [, tagName] = tagMatch;
  return `semantic-release could not create ${tagName} because that tag already exists in the local git repository. GitHub releases and visible remote tags can already be gone while the local tag still remains. Delete the local tag with 'git tag -d ${tagName}' and remove any matching remote tag ref before retrying.`;
}

/** Run subprocesses in either streaming or captured mode without losing timing data. */
async function runCommand(command: Command, outputMode: OutputMode = "inherit", cwd = process.cwd()): Promise<CommandResult> {
  const [executable, ...arguments_] = command;
  const startedAt = Date.now();
  const shouldCaptureOutput = outputMode === "capture";
  const child = Bun.spawn([executable, ...arguments_], { cwd, env: process.env, stderr: shouldCaptureOutput ? "pipe" : "inherit", stdin: shouldCaptureOutput ? "ignore" : "inherit", stdout: shouldCaptureOutput ? "pipe" : "inherit" });
  const readStream = async (stream: null | ReadableStream<Uint8Array> | undefined): Promise<string> => (stream ? await new Response(stream).text() : "");
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, shouldCaptureOutput ? readStream(child.stdout) : Promise.resolve(""), shouldCaptureOutput ? readStream(child.stderr) : Promise.resolve("")]);
  return { durationInMilliseconds: Date.now() - startedAt, exitCode, stderr, stdout };
}

/** Abort immediately on failing steps so later release stages never run on invalid state. */
async function runStepOrExit(step: ReleaseStep, cwd?: string): Promise<void> {
  logRelease(`Starting: ${step.label}`);
  const result = await runCommand(step.command, "inherit", cwd);
  if (result.exitCode !== 0) {
    logRelease(`Failed: ${step.label} (exit code ${result.exitCode} after ${result.durationInMilliseconds}ms)`);
    throw new ReleaseWorkflowError(step.label, result.exitCode);
  }
  logRelease(`Completed: ${step.label} (${result.durationInMilliseconds}ms)`);
}

const runCommandForStdout = async (command: Command, failureLabel: string): Promise<string> => {
  const result = await runCommand(command, "capture");
  if (result.exitCode === 0) return result.stdout.trim();
  const stderr = result.stderr.trim();
  return failRelease(stderr.length > 0 ? `${failureLabel}: ${stderr}` : `${failureLabel}: command exited with ${result.exitCode}.`);
};

/** Preserve captured subprocess output while still allowing custom failure handling. */
const writeCapturedOutput = (stream: "stderr" | "stdout", text: string): void => {
  if (text.length === 0) return;
  const target = stream === "stdout" ? process.stdout : process.stderr;
  target.write(text.endsWith("\n") ? text : `${text}\n`);
};

/** Parse git's NUL-delimited file lists without dropping paths that contain spaces. */
const parseNullDelimitedPaths = (text: string): string[] => text.split("\0").filter((path) => path.length > 0);

/** Capture raw stdout for commands whose output uses NUL delimiters instead of newlines. */
const runCommandForRawStdout = async (command: Command, failureLabel: string): Promise<string> => {
  const result = await runCommand(command, "capture");
  if (result.exitCode === 0) return result.stdout;
  const stderr = result.stderr.trim();
  return failRelease(stderr.length > 0 ? `${failureLabel}: ${stderr}` : `${failureLabel}: command exited with ${result.exitCode}.`);
};

/** Isolate staged and committed snapshots while reusing the main dependency tree. */
async function withSnapshot<T>(prefix: string, materialize: (path: string) => Promise<void>, cleanup: (path: string) => Promise<void>, action: (path: string) => Promise<T>): Promise<T> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  let isMaterialized = false;
  try {
    await materialize(path);
    isMaterialized = true;
    await access(join(process.cwd(), "node_modules")).catch(() => failRelease("node_modules is required for staged CI/CD validation. Install dependencies before continuing."));
    await symlink(join(process.cwd(), "node_modules"), join(path, "node_modules"), "dir");
    return await action(path);
  } finally {
    await (isMaterialized ? cleanup(path) : rm(path, { force: true, recursive: true }));
  }
}

const askYesNo = async (question: string): Promise<boolean> => {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return ["y", "yes"].includes((await readline.question(question)).trim().toLowerCase());
  } finally {
    readline.close();
  }
};

const getHeadRevision = async (label: string): Promise<string> => await runCommandForStdout(git("rev-parse", "HEAD"), label);
const getOriginMainRevision = async (label: string): Promise<string> => await runCommandForStdout(git("rev-parse", `refs/remotes/origin/${MAIN_BRANCH}`), label);
const hasPendingChanges = async (): Promise<boolean> => (await runCommandForStdout(git("status", "--porcelain"), "Unable to inspect the git worktree")).length > 0;
const hasStagedChanges = async (): Promise<boolean> => (await runCommandForStdout(git("diff", "--cached", "--name-only"), "Unable to inspect staged release changes")).length > 0;

/**
 * Decide how the release candidate should be prepared before validation. A
 * clean worktree means HEAD and the index already represent the same committed
 * candidate, while an unstaged dirty worktree must be validated from a
 * worktree snapshot instead of the staged index.
 */
const ensureStagedReleaseCandidate = async (): Promise<ReleaseCandidatePreparationAction> => {
  const preparationAction = determineReleaseCandidatePreparationAction(await hasStagedChanges(), await hasPendingChanges());
  if (preparationAction === "continue") return preparationAction;
  if (preparationAction === "use-clean-head") {
    logRelease("No staged release candidate found at startup, but the worktree is clean. Continuing with the committed HEAD snapshot.");
    return preparationAction;
  }
  logRelease("No staged release candidate found at startup. Validating the current worktree snapshot before any later commit step.");
  return preparationAction;
};
const fetchOriginMain = async (label = `Fetch origin/${MAIN_BRANCH}`): Promise<void> => await runStepOrExit({ command: git("fetch", "origin", MAIN_BRANCH), label });
const readMainBranchRevisionState = async (): Promise<MainBranchRevisionState> => {
  const [headRevision, remoteRevision] = await Promise.all([
    getHeadRevision("Unable to resolve local HEAD"),
    getOriginMainRevision(`Unable to resolve origin/${MAIN_BRANCH}`),
  ]);
  return { headRevision, remoteRevision };
};
const formatMainBranchMismatch = (state: MainBranchRevisionState): string => `Local HEAD (${state.headRevision}) does not match origin/${MAIN_BRANCH} (${state.remoteRevision}). Push or reconcile before continuing.`;

async function acquireReleaseLock(): Promise<() => Promise<void>> {
  // git rev-parse --git-dir returns a relative path (.git) for normal repos but an
  // absolute path for worktrees. resolve() handles both cases correctly; path.join does not.
  const lockDirectoryPath = join(resolve(process.cwd(), await runCommandForStdout(git("rev-parse", "--git-dir"), "Unable to resolve the git directory")), CICD_LOCK_NAME);
  const metadataPath = join(lockDirectoryPath, "metadata.json");
  const writeMetadata = async (): Promise<void> => await writeFile(metadataPath, JSON.stringify({ acquiredAt: new Date().toISOString(), pid: process.pid }, null, 2), "utf8");
  try {
    await mkdir(lockDirectoryPath);
  } catch (error_) {
    const isExistingLock = error_ instanceof Error && "code" in error_ && error_.code === "EEXIST";
    if (!isExistingLock) throw error_;
    const metadata = await readFile(metadataPath, "utf8").then((text) => JSON.parse(text) as { pid?: number }).catch(() => undefined);
    const isStale = typeof metadata?.pid === "number" && (() => { try { process.kill(metadata.pid, 0); return false; } catch (processError) { return processError instanceof Error && "code" in processError && processError.code === "ESRCH"; } })();
    if (!isStale) failRelease(`Another CI/CD run already holds ${lockDirectoryPath}. Remove it only after confirming the previous process is gone.`);
    await rm(lockDirectoryPath, { force: true, recursive: true });
    await mkdir(lockDirectoryPath);
    logRelease(`Recovered stale CI/CD lock at ${lockDirectoryPath}.`);
  }
  await writeMetadata();
  return async (): Promise<void> => await rm(lockDirectoryPath, { force: true, recursive: true });
}

async function commitPendingChangesIfRequested(): Promise<void> {
  if (!(await hasPendingChanges())) return;
  logRelease("Pending changes detected.");
  if (await hasCommandAvailable("gitaicmt")) {
    if (!(await askYesNo("Run gitaicmt? (y/n) "))) {
      logRelease("Commit step skipped by user.");
      return;
    }
    await runStepOrExit({ command: ["gitaicmt"], label: "Create commit with gitaicmt" });
    return;
  }
  if (!(await askYesNo("Commit now as needed. Ready to proceed? (y/n) "))) {
    logRelease("Commit step skipped by user.");
    return;
  }
  if (await hasPendingChanges()) {
    failRelease("CI/CD flow still has pending changes. Commit or clean the release candidate before continuing.");
  }
}

async function ensureHeadMatchesOriginMain(fetchLabel = `Fetch origin/${MAIN_BRANCH}`): Promise<string> {
  await fetchOriginMain(fetchLabel);
  const state = await readMainBranchRevisionState();
  if (determineMainBranchSyncAction("pre-release", state) === "fail") {
    failRelease(formatMainBranchMismatch(state));
  }
  return state.headRevision;
}

/** Fast-forward main to the source branch tip so semantic-release's commit is the sole release marker. */
async function fastForwardBranchIntoMain(sourceBranch: string): Promise<void> {
  if (sourceBranch === MAIN_BRANCH) return;
  await runStepOrExit({ command: git("checkout", MAIN_BRANCH), label: `Check out ${MAIN_BRANCH}` });
  await runStepOrExit({ command: git("merge", "--ff-only", sourceBranch), label: `Fast-forward ${MAIN_BRANCH} to '${sourceBranch}'` });
}

/** Preserve the source branch commits remotely before the release merge lands on main. */
async function pushSourceBranchIfNeeded(sourceBranch: string): Promise<void> {
  if (sourceBranch === MAIN_BRANCH) return;
  await runStepOrExit({ command: git("push", "--force-with-lease", "origin", sourceBranch), label: `Push ${sourceBranch} to origin` });
}

/**
 * Rebase source branch onto origin/main when main has advanced since the
 * last sync, so the subsequent fast-forward into main succeeds cleanly.
 */
async function reconcileSourceBranchWithMain(sourceBranch: string): Promise<void> {
  if (sourceBranch === MAIN_BRANCH) return;
  await fetchOriginMain();
  const ancestorCheck = await runCommand(git("merge-base", "--is-ancestor", `refs/remotes/origin/${MAIN_BRANCH}`, "HEAD"), "capture");
  if (ancestorCheck.exitCode === 0) return;
  logRelease(`Rebasing '${sourceBranch}' onto origin/${MAIN_BRANCH} so fast-forward into ${MAIN_BRANCH} succeeds.`);
  await runStepOrExit({ command: git("rebase", `refs/remotes/origin/${MAIN_BRANCH}`), label: `Rebase '${sourceBranch}' onto origin/${MAIN_BRANCH}` });
}

/** Resolve the current branch name and fail if in detached HEAD state. */
async function resolveSourceBranch(): Promise<string> {
  const branchName = await runCommandForStdout(git("rev-parse", "--abbrev-ref", "HEAD"), "Unable to determine the current branch");
  if (branchName === "HEAD") failRelease("CI/CD flow must run from a named branch, not detached HEAD.");
  return branchName;
}

/** Restore the operator's starting branch after temporarily checking out main during release automation. */
async function restoreSourceBranch(sourceBranch: string): Promise<void> {
  const currentBranch = await runCommandForStdout(git("rev-parse", "--abbrev-ref", "HEAD"), "Unable to determine the current branch for cleanup");
  if (currentBranch === sourceBranch) return;
  await runStepOrExit({ command: git("checkout", sourceBranch), label: `Restore ${sourceBranch}` });
}

const ensureNoStagedChangesRemain = async (): Promise<void> => {
  if (await hasStagedChanges()) failRelease("CI/CD flow still has staged changes after commit creation. Commit or unstage the remaining release candidate before continuing.");
};

/** Refresh local tags from origin so semantic-release sees the canonical remote tag graph. */
const syncOriginTagsForRelease = async (): Promise<void> => await runStepOrExit({ command: git("fetch", "--tags", "--force", "origin"), label: "Force-sync origin tags" });

const listWorktreeOverlayPaths = async (): Promise<string[]> => parseNullDelimitedPaths(await runCommandForRawStdout(git("ls-files", "--modified", "--others", "--exclude-standard", "-z"), "Unable to list worktree snapshot overlay files"));

const listDeletedWorktreePaths = async (): Promise<string[]> => parseNullDelimitedPaths(await runCommandForRawStdout(git("ls-files", "--deleted", "-z"), "Unable to list deleted worktree files"));

/**
 * Stash all non-staged working tree changes under a uniquely named entry so
 * they survive the git reset that follows semantic-release. Returns the stash
 * name if a stash was created, or undefined when the worktree was already
 * clean.
 */
const stashWorktreeChanges = async (): Promise<string | undefined> => {
  if (!(await hasPendingChanges())) return undefined;
  const stashName = `cicd-release-${randomUUID()}-${new Date().toISOString().replaceAll(":", "-")}`;
  await runStepOrExit({ command: git("stash", "push", "--include-untracked", "--message", stashName), label: "Stash worktree changes before release" });
  logRelease(`Non-staged worktree changes stashed as '${stashName}'. They will be restored after release.`);
  return stashName;
};

/**
 * Locate the named stash entry by message, pop it back onto the working tree,
 * and remove the stash entry. Warns without throwing if the entry is missing
 * so a manual restore is still possible.
 */
const restoreStashedChanges = async (stashName: string): Promise<void> => {
  const stashList = await runCommandForStdout(git("stash", "list"), "Unable to list git stashes");
  const stashEntry = stashList.split("\n").find((line) => line.includes(stashName));
  if (!stashEntry) {
    logRelease(`Warning: stash '${stashName}' was not found in the stash list. It may have already been restored.`);
    return;
  }
  const stashRef = stashEntry.split(":")[0]?.trim();
  if (!stashRef) failRelease(`Unable to parse stash ref from entry: ${stashEntry}. Locate the stash manually with 'git stash list' and restore it with 'git stash pop stash@{N}'.`);
  await runStepOrExit({ command: git("stash", "pop", stashRef), label: `Restore stash entry ${stashRef} (conflicts require manual resolution before dropping)` });
  logRelease(`Worktree stash '${stashName}' has been restored and removed.`);
};

const runBunCheckAgainstIndexSnapshot = async (): Promise<void> => await withSnapshot("check-suite-cicd-", async (path) => await runStepOrExit({ command: git("checkout-index", "--all", `--prefix=${path}/`), label: "Materialize the staged snapshot" }), async (path) => await rm(path, { force: true, recursive: true }), async (path) => {
  logRelease(`Running bun check in staged snapshot ${path}`);
  await runStepOrExit({ command: ["bun", "check"], label: "Run bun check for the staged snapshot" }, path);
});

/** Materialize the current non-ignored worktree state for isolated validation. */
const runBunCheckAgainstWorktreeSnapshot = async (): Promise<void> => await withSnapshot(
  "check-suite-cicd-",
  async (path) => {
    await runStepOrExit({ command: git("checkout-index", "--all", `--prefix=${path}/`), label: "Materialize the tracked worktree base" });
    const [deletedPaths, overlayPaths] = await Promise.all([listDeletedWorktreePaths(), listWorktreeOverlayPaths()]);
    await Promise.all(deletedPaths.map(async (relativePath) => await rm(join(path, relativePath), { force: true, recursive: true })));
    await Promise.all(overlayPaths.map(async (relativePath) => {
      const destinationPath = join(path, relativePath);
      await mkdir(dirname(destinationPath), { recursive: true });
      await cp(join(process.cwd(), relativePath), destinationPath, { force: true, recursive: true, verbatimSymlinks: true });
    }));
  },
  async (path) => await rm(path, { force: true, recursive: true }),
  async (path) => {
    logRelease(`Running bun check in worktree snapshot ${path}`);
    await runStepOrExit({ command: ["bun", "check"], label: "Run bun check for the worktree snapshot" }, path);
  },
);

/** Validate the staged or committed candidate, run semantic-release on main, then sync branches. */
async function main(): Promise<void> {
  const releaseLock = await acquireReleaseLock();
  let sourceBranch: string | undefined;
  // Tracks a pre-release stash so it can be surfaced in the finally block if
  // the release flow fails between stash creation and successful restoration.
  let releaseStashName: string | undefined;
  try {
    sourceBranch = await resolveSourceBranch();
    const preparationAction = await ensureStagedReleaseCandidate();
    if (preparationAction === "use-worktree") await runBunCheckAgainstWorktreeSnapshot();
    else await runBunCheckAgainstIndexSnapshot();
    await commitPendingChangesIfRequested();
    await ensureNoStagedChangesRemain();
    await reconcileSourceBranchWithMain(sourceBranch);
    await pushSourceBranchIfNeeded(sourceBranch);
    await fastForwardBranchIntoMain(sourceBranch);
    await runStepOrExit({ command: git("push", "origin", MAIN_BRANCH), label: `Push ${MAIN_BRANCH} to origin` });
    const releaseRevision = await ensureHeadMatchesOriginMain();
    if (!(await askYesNo("Publish the release now? (y/n) "))) return void logRelease("Publish step skipped by user.");
    if ((await getHeadRevision("Unable to resolve the current revision")) !== releaseRevision) failRelease(`HEAD changed during the CI/CD workflow (${releaseRevision} -> ${await getHeadRevision("Unable to resolve the current revision")}). Restart from a stable state.`);
    await ensureHeadMatchesOriginMain();
    releaseStashName = await stashWorktreeChanges();
    await syncOriginTagsForRelease();
    await runSemanticReleaseOrExit();
    await runStepOrExit({ command: git("fetch", "origin", MAIN_BRANCH), label: `Fetch origin/${MAIN_BRANCH} after release` });
    await runStepOrExit({ command: git("reset", "--hard", `refs/remotes/origin/${MAIN_BRANCH}`), label: `Reset local ${MAIN_BRANCH} to origin/${MAIN_BRANCH}` });
    await syncSourceBranchWithMain(sourceBranch);
    if (releaseStashName !== undefined) {
      await restoreStashedChanges(releaseStashName);
      releaseStashName = undefined;
    }
  } finally {
    if (typeof releaseStashName === "string") {
      logRelease(`Release stash '${releaseStashName}' was not automatically restored because the workflow did not complete successfully. Run 'git stash list' to locate it. If the working tree has conflict markers, resolve them first and then run 'git stash drop stash@{N}'. If the tree is clean, run 'git stash pop stash@{N}' to restore directly.`);
    }
    if (typeof sourceBranch === "string") {
      await restoreSourceBranch(sourceBranch);
    }
    await releaseLock();
  }
}

/** Run semantic-release with captured output so known git tag collisions can be surfaced clearly. */
async function runSemanticReleaseOrExit(): Promise<void> {
  const step: ReleaseStep = {
    command: ["bunx", "semantic-release", "--no-ci"],
    label: "Run semantic-release",
  };
  logRelease(`Starting: ${step.label}`);
  const result = await runCommand(step.command, "capture");
  writeCapturedOutput("stdout", result.stdout);
  writeCapturedOutput("stderr", result.stderr);
  if (result.exitCode === 0) {
    logRelease(`Completed: ${step.label} (${result.durationInMilliseconds}ms)`);
    return;
  }
  const existingLocalTagFailure = formatExistingLocalTagFailure(result.stderr);
  if (existingLocalTagFailure) {
    logRelease(existingLocalTagFailure);
    throw new ReleaseWorkflowError(existingLocalTagFailure, result.exitCode);
  }
  logRelease(`Failed: ${step.label} (exit code ${result.exitCode} after ${result.durationInMilliseconds}ms)`);
  throw new ReleaseWorkflowError(step.label, result.exitCode);
}

/** Fast-forward source branch to include the release merge and version bump so it stays in sync with main. */
async function syncSourceBranchWithMain(sourceBranch: string): Promise<void> {
  if (sourceBranch === MAIN_BRANCH) return;
  await runStepOrExit({ command: git("checkout", sourceBranch), label: `Check out ${sourceBranch}` });
  await runStepOrExit({ command: git("merge", "--ff-only", MAIN_BRANCH), label: `Fast-forward '${sourceBranch}' to ${MAIN_BRANCH}` });
  await runStepOrExit({ command: git("push", "origin", sourceBranch), label: `Push ${sourceBranch} to origin` });
}

if (import.meta.main) {
  try {
    await main();
  } catch (error_) {
    if (error_ instanceof ReleaseWorkflowError) process.exitCode = error_.exitCode;
    else throw error_;
  }
}