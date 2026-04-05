import { runBufferedCommand } from "./command";

const GIT_VISIBLE_FILES_ARGS = [
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "--full-name",
  "--",
  ".",
] as const;

export type GitVisibleFiles =
  | { exitCode: number; kind: "failure"; output: string }
  | { kind: "fallback" }
  | { kind: "resolved"; paths: string[] };

export function parseFileList(output: string): string[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function resolveGitVisibleFiles(cwd: string): GitVisibleFiles {
  const result = runBufferedCommand(cwd, "git", [...GIT_VISIBLE_FILES_ARGS]);

  if (result.exitCode === 0) {
    return { kind: "resolved", paths: parseFileList(result.output) };
  }

  if (/not a git repository/i.test(result.output)) {
    return { kind: "fallback" };
  }

  return { exitCode: result.exitCode, kind: "failure", output: result.output };
}
