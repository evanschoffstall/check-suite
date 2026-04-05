import type {
  ArchitectureProject,
  ArchitectureViolation,
} from "@/steps/architecture/foundation/index.ts";

import { inferLayerGroup } from "./layering";

/** Builds the layer-direction violation for a single import edge when needed. */
export function buildLayerViolation(
  project: ArchitectureProject,
  entry: ArchitectureProject["imports"][number],
): ArchitectureViolation | null {
  if (!entry.resolvedPath) {
    return null;
  }

  const sourceLayer = inferLayerGroup(
    entry.sourcePath,
    project.config.layerGroups,
  );
  const targetLayer = inferLayerGroup(
    entry.resolvedPath,
    project.config.layerGroups,
  );

  if (!sourceLayer || !targetLayer || sourceLayer.rank >= targetLayer.rank) {
    return null;
  }

  return {
    code: "layer-direction",
    message: `${entry.sourcePath} (${sourceLayer.group.name}) depends on ${entry.resolvedPath} (${targetLayer.group.name}); lower layers must not depend on higher layers`,
  };
}
