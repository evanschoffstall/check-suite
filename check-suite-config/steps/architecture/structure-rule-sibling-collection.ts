import { dirname } from "node:path";

import type { ArchitectureProject } from "./types.ts";

/** Collects directory and file sibling names grouped by their parent path. */
export function collectSiblingsByParent(project: ArchitectureProject): {
  directoriesByParent: Map<string, Set<string>>;
  filesByParent: Map<string, string[]>;
} {
  return {
    directoriesByParent: collectDirectorySiblingsByParent(project),
    filesByParent: collectFileSiblingsByParent(project),
  };
}

function collectDirectorySiblingsByParent(
  project: ArchitectureProject,
): Map<string, Set<string>> {
  const directoriesByParent = new Map<string, Set<string>>();

  for (const directoryPath of project.directories) {
    const parentPath = dirname(directoryPath).replace(/^\.$/u, "");
    const siblingDirectories =
      directoriesByParent.get(parentPath) ?? new Set<string>();
    siblingDirectories.add(directoryPath.split("/").pop() ?? directoryPath);
    directoriesByParent.set(parentPath, siblingDirectories);
  }

  return directoriesByParent;
}

function collectFileSiblingsByParent(
  project: ArchitectureProject,
): Map<string, string[]> {
  const filesByParent = new Map<string, string[]>();

  for (const filePath of project.files) {
    const parentPath = dirname(filePath).replace(/^\.$/u, "");
    const siblingFiles = filesByParent.get(parentPath) ?? [];
    siblingFiles.push(filePath.split("/").pop() ?? filePath);
    filesByParent.set(parentPath, siblingFiles);
  }

  return filesByParent;
}
