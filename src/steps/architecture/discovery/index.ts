import type { ArchitectureProject } from "@/steps/architecture/foundation/index.ts";

import {
  collectCodeFiles,
  collectDirectoryFacts,
  collectSourceFacts,
  discoverAliasMappings,
  discoverBoundaryDirectories,
} from "@/steps/architecture/analysis/index.ts";
import { collectImports } from "@/steps/architecture/import/index.ts";

import { discoverCodeRoots, normalizeArchitectureConfig } from "./config";

/** Discovers the code roots, boundaries, aliases, files, and imports in a repository. */
export function discoverArchitectureProject(
  cwd: string,
  config: ReturnType<typeof normalizeArchitectureConfig>,
): ArchitectureProject {
  const codeRoots = discoverCodeRoots(cwd, config);
  const aliasMappings = discoverAliasMappings(cwd, codeRoots);
  const directoryFacts = collectDirectoryFacts(cwd, codeRoots, config);
  const boundaries = discoverBoundaryDirectories(cwd, codeRoots, config);
  const files = collectCodeFiles(cwd, codeRoots, config);
  const sourceFacts = collectSourceFacts(cwd, files, config.entrypointNames);

  return {
    aliasMappings,
    boundaries,
    codeRoots,
    config,
    directories: directoryFacts.map((fact) => fact.path),
    directoryFacts,
    files,
    imports: collectImports(cwd, files, aliasMappings),
    sourceFacts,
  };
}

export { normalizeArchitectureConfig } from "./config";
