export type { CodeTargetDiscoveryOptions } from "./code-targets.ts";
export {
  defineCodeTargetDiscovery,
  discoverDefaultCodeRoots,
  normalizeArchitectureConfig,
} from "./config";
export { flattenArchitectureConfigSections } from "./grouped-config.ts";
export { discoverArchitectureProject } from "./project.ts";
