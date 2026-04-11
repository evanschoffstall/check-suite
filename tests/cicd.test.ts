import { describe, expect, test } from "bun:test";

import {
  determineMainBranchSyncAction,
  determineReleaseCandidatePreparationAction,
} from "../scripts/cicd.ts";

describe("cicd release candidate preparation", () => {
  test("continues with a clean committed head when nothing is staged", () => {
    expect(determineReleaseCandidatePreparationAction(false, false)).toBe(
      "use-clean-head",
    );
  });

  test("auto-stages when release changes are still only in the worktree", () => {
    expect(determineReleaseCandidatePreparationAction(false, true)).toBe(
      "auto-stage",
    );
  });

  test("leaves an explicit staged candidate unchanged", () => {
    expect(determineReleaseCandidatePreparationAction(true, true)).toBe(
      "continue",
    );
  });
});

describe("cicd main branch sync action", () => {
  test("fails pre-release when local main is behind origin/main", () => {
    expect(
      determineMainBranchSyncAction("pre-release", {
        headRevision: "abc123",
        remoteRevision: "def456",
      }),
    ).toBe("fail");
  });

  test("allows post-release fast-forward when semantic-release advances main", () => {
    expect(
      determineMainBranchSyncAction("post-release", {
        headRevision: "abc123",
        remoteRevision: "def456",
      }),
    ).toBe("fast-forward");
  });
});