import type { ArchitectureProject } from "./types.ts";

import { discoverAliasMappings } from "./alias-mappings.ts";
import {
  discoverCodeRoots,
  normalizeArchitectureConfig,
} from "./discovery-config.ts";
import { collectImports } from "./import-collection.ts";
import {
  collectCodeFiles,
  collectDirectoryFacts,
  discoverBoundaryDirectories,
} from "./layout.ts";
import { collectSourceFacts } from "./source-analysis.ts";

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

export { normalizeArchitectureConfig } from "./discovery-config.ts";
