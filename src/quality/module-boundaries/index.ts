export { analyzeArchitecture, formatArchitectureViolations } from "./analyze";
export {
  inferAllowedRootFileStems,
  inferCentralSurfacePathPrefixes,
  inferDependencyPolicies,
  inferEntrypointNames,
  inferExplicitPublicSurfacePaths,
} from "./policy-inference";
export { runArchitectureCheck } from "./runner";
export type { ArchitectureCheckResult } from "./runner";
export { defineArchitectureStep } from "./step.ts";
export type { ArchitectureStepOptions } from "./step.ts";
export {
  defineCodeTargetDiscovery,
  discoverDefaultCodeRoots,
} from "@/quality/module-boundaries/discovery/index.ts";
export type { CodeTargetDiscoveryOptions } from "@/quality/module-boundaries/discovery/index.ts";
export type { ArchitectureAnalyzerConfig } from "@/quality/module-boundaries/foundation/index.ts";
