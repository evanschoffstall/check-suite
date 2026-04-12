import type { ArchitectureProject } from "@/quality/module-boundaries/foundation/index.ts";

import {
  collectCodeFiles,
  collectDirectoryFacts,
  collectSourceFacts,
  discoverAliasMappings,
  discoverBoundaryDirectories,
} from "@/quality/module-boundaries/analysis/index.ts";
import { collectImports } from "@/quality/module-boundaries/import/index.ts";

import { discoverCodeRoots, normalizeArchitectureConfig } from "./config";

export function discoverArchitectureProject(
  cwd: string,
  config: ReturnType<typeof normalizeArchitectureConfig>,
): ArchitectureProject {
  const codeRoots = discoverCodeRoots(cwd, config);
  const aliasMappings = discoverAliasMappings(cwd, codeRoots);
  const directoryFacts = collectDirectoryFacts(cwd, codeRoots, config);
  const boundaries = discoverBoundaryDirectories(cwd, codeRoots, config);
  const files = collectCodeFiles(cwd, codeRoots, config);
  const sourceFacts = collectSourceFacts(cwd, files, aliasMappings, config);

  return {
    aliasMappings,
    boundaries,
    codeRoots,
    config,
    directories: directoryFacts.map((fact) => fact.path),
    directoryFacts,
    files,
    imports: collectImports(cwd, files, aliasMappings, config),
    sourceFacts,
  };
}
