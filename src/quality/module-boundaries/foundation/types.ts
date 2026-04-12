/** Alias mapping derived from tsconfig/jsconfig path configuration. */
export interface AliasMapping {
  prefix: string;
  targetRoots: string[];
}

/** Configurable thresholds and discovery knobs for the architecture analyzer. */
export interface ArchitectureAnalyzerConfig {
  allowedImpurePublicSurfacePaths?: string[];
  allowedRootFileStems?: string[];
  allowPublicSurfaceReExportChains?: boolean;
  centralSurfacePathPrefixes?: string[];
  codeTargets?: ArchitectureCodeTargetsConfig;
  dependencyPolicies?: ArchitectureDependencyPolicy[];
  discovery?: ArchitectureDiscoveryConfig;
  /** Enables directory-level file-name case consistency checks. */
  enforceConsistentFileNameCase?: boolean;
  entrypointNames?: string[];
  entrypointRules?: ArchitectureEntrypointRule[];
  explicitPublicSurfacePaths?: string[];
  /** Glob patterns matched against file basenames or stems, e.g. `index.ts`. */
  fileNameCaseIgnoreFileGlobs?: string[];
  /** Glob patterns matched against repo-relative file paths such as generated-file trees. */
  fileNameCaseIgnorePathGlobs?: string[];
  ignoredDirectories?: string[];
  junkDrawerDirectoryNames?: string[];
  /** Glob patterns matched against file basenames and stems, e.g. `*helper*`. */
  junkDrawerFileNamePatterns?: string[];
  junkDrawerFileStems?: string[];
  layerGroups?: ArchitectureLayerGroup[];
  maxCentralSurfaceExports?: number;
  maxDirectoryDepth?: number;
  maxEntrypointReExports?: number;
  maxInternalImportsPerFile?: number;
  maxPolicyFanOut?: number;
  maxSiblingImports?: number;
  maxWildcardExportsPerPublicSurface?: number;
  minRepeatedDeepImports?: number;
  policy?: ArchitecturePolicyConfig;
  requireAcyclicDependencyPolicies?: boolean;
  requireCompleteDependencyPolicyCoverage?: boolean;
  requireTypeOnlyImportsForTypeOnlyPolicies?: boolean;
  rootDirectories?: string[];
  rules?: ArchitectureRulesConfig;
  sharedHomeNames?: string[];
  testDirectories?: string[];
}

/** Explicit file-target configuration for repositories that define their own source surface. */
export interface ArchitectureCodeTargetsConfig {
  declarationFilePatterns?: string[];
  includePatterns?: string[];
  resolutionEntrypointNames?: string[];
  resolutionExtensions?: string[];
  testFilePatterns?: string[];
}

/** A repository-specific dependency policy for an owned architectural surface. */
export interface ArchitectureDependencyPolicy {
  allowedDependents?: string[];
  allowedRuntimeImporters?: string[];
  isTypeOnly?: boolean;
  mayDependOn: string[];
  name: string;
  pathPrefixes: string[];
  role?: ArchitectureDependencyPolicyRole;
  surfaceTier?: ArchitectureSurfaceTier;
}

/** Generic owner role used for architectural budget rules. */
export type ArchitectureDependencyPolicyRole = "orchestration" | "standard";

/** User-facing discovery settings for architecture analysis. */
export interface ArchitectureDiscoveryConfig {
  codeTargets?: ArchitectureCodeTargetsConfig;
  ignoredDirectories?: string[];
  rootDirectories?: string[];
  testDirectories?: string[];
}

/** Generic semantics for one configured architectural entrypoint stem. */
export interface ArchitectureEntrypointRule {
  allowSiblingEntrypoints?: boolean;
  allowTopLevelStatements?: boolean;
  name: string;
}

/** A normalized layer family used for generic dependency-direction checks. */
export interface ArchitectureLayerGroup {
  name: string;
  patterns: string[];
}

/** User-facing policy settings for architecture analysis. */
export interface ArchitecturePolicyConfig {
  dependencyPolicies?: ArchitectureDependencyPolicy[];
  entrypoints?: ArchitecturePolicyEntrypointConfig;
  infer?: boolean;
  layerGroups?: ArchitectureLayerGroup[];
}

/** User-facing entrypoint settings for architecture ownership discovery. */
export interface ArchitecturePolicyEntrypointConfig {
  names?: string[];
  rules?: ArchitectureEntrypointRule[];
}

/** Repository-wide discovery state reused by multiple architecture checks. */
export interface ArchitectureProject {
  aliasMappings: AliasMapping[];
  boundaries: BoundaryDirectory[];
  codeRoots: CodeRoots;
  config: NormalizedArchitectureAnalyzerConfig;
  directories: string[];
  directoryFacts: DirectoryFacts[];
  files: string[];
  imports: ImportRecord[];
  sourceFacts: SourceFileFacts[];
}

/** Grouped user-facing rule settings for architecture analysis. */
export interface ArchitectureRulesConfig {
  "broad-barrel-surface"?: BroadBarrelSurfaceRuleConfig;
  "central-surface-budget"?: CentralSurfaceBudgetRuleConfig;
  "dependency-policy-coverage"?: EnabledRuleConfig;
  "dependency-policy-cycle"?: EnabledRuleConfig;
  "dependency-policy-fan-out"?: DependencyPolicyFanOutRuleConfig;
  "directory-depth"?: DirectoryDepthRuleConfig;
  "junk-drawer-directory"?: JunkDrawerDirectoryRuleConfig;
  "junk-drawer-file"?: JunkDrawerFileRuleConfig;
  "mixed-file-name-case"?: MixedFileNameCaseRuleConfig;
  "public-surface-purity"?: PublicSurfacePurityRuleConfig;
  "public-surface-re-export-chain"?: PublicSurfaceReExportChainRuleConfig;
  "public-surface-wildcard-export"?: PublicSurfaceWildcardExportRuleConfig;
  "repeated-deep-import"?: RepeatedDeepImportRuleConfig;
  "root-file-ownership"?: RootFileOwnershipRuleConfig;
  "shared-home"?: SharedHomeRuleConfig;
  "sibling-import-cohesion"?: SiblingImportCohesionRuleConfig;
  "too-many-internal-dependencies"?: TooManyInternalDependenciesRuleConfig;
  "type-only-policy-import"?: EnabledRuleConfig;
}

/** Stability tier for exported architectural surfaces. */
export type ArchitectureSurfaceTier =
  | "internal-public"
  | "private-runtime"
  | "public";

/** A concrete architecture violation emitted by the analyzer. */
export interface ArchitectureViolation {
  code: string;
  message: string;
}

/** A feature or layer directory that exposes a stable public entrypoint. */
export interface BoundaryDirectory {
  entrypointPaths: string[];
  path: string;
}

/** Rule options for the broad-barrel-surface violation. */
export interface BroadBarrelSurfaceRuleConfig {
  maxReExports?: number;
}

/** Rule options for the central-surface-budget violation. */
export interface CentralSurfaceBudgetRuleConfig {
  maxExports?: number;
  pathPrefixes?: string[];
}

/** A top-level code root discovered from the current repository layout. */
export interface CodeRoots {
  directories: string[];
  files: string[];
}

/** Rule options for the dependency-policy-fan-out violation. */
export interface DependencyPolicyFanOutRuleConfig {
  maxDependencies?: number;
}

/** Rule options for the directory-depth violation. */
export interface DirectoryDepthRuleConfig {
  maxDepth?: number;
}

/** Aggregated code-layout facts for a single directory. */
export interface DirectoryFacts {
  childDirectoryPaths: string[];
  codeFilePaths: string[];
  entrypointPaths: string[];
  path: string;
}

/** Rule options for boolean dependency-policy coverage enforcement. */
export interface EnabledRuleConfig {
  enabled?: boolean;
}

/** Resolved import metadata for a single source file import edge. */
export interface ImportRecord {
  isReExport: boolean;
  isSideEffectOnly: boolean;
  isTypeOnly: boolean;
  resolvedPath: null | string;
  sourcePath: string;
  specifier: string;
}

/** Rule options for the junk-drawer-directory violation. */
export interface JunkDrawerDirectoryRuleConfig {
  directoryNames?: string[];
}

/** Rule options for the junk-drawer-file violation. */
export interface JunkDrawerFileRuleConfig {
  fileNamePatterns?: string[];
  fileStems?: string[];
}

/** Rule options for mixed file-name case violations within one directory. */
export interface MixedFileNameCaseRuleConfig {
  enabled?: boolean;
  ignoreFileGlobs?: string[];
  ignorePathGlobs?: string[];
}

/** Fully normalized runtime config used by the analyzer after grouped input is flattened. */
export type NormalizedArchitectureAnalyzerConfig = Pick<ArchitectureAnalyzerConfig, "discovery" | "policy" | "rules"> & Required<
  Omit<ArchitectureAnalyzerConfig, "discovery" | "policy" | "rules">
>;

/** Rule options for the public-surface-purity violation. */
export interface PublicSurfacePurityRuleConfig {
  allowedPaths?: string[];
}

/** Rule options for the public-surface-re-export-chain violation. */
export interface PublicSurfaceReExportChainRuleConfig {
  allow?: boolean;
}

/** Rule options for the public-surface-wildcard-export violation. */
export interface PublicSurfaceWildcardExportRuleConfig {
  maxWildcardExports?: number;
}

/** Rule options for the repeated-deep-import violation. */
export interface RepeatedDeepImportRuleConfig {
  minImporters?: number;
}

/** Rule options for the root-file-ownership violation. */
export interface RootFileOwnershipRuleConfig {
  allowedRootFileStems?: string[];
}

/** Rule options for shared-home consistency violations. */
export interface SharedHomeRuleConfig {
  names?: string[];
}

/** Rule options for the sibling-import-cohesion violation. */
export interface SiblingImportCohesionRuleConfig {
  maxSiblingImports?: number;
}

/** AST-derived source facts used by entrypoint and cohesion rules. */
export interface SourceFileFacts {
  directoryPath: string;
  exportedSymbolCount: number;
  exportModuleSpecifiers: string[];
  isEntrypoint: boolean;
  path: string;
  reExports: SourceFileReExport[];
  runtimeOperationCount: number;
  stem: string;
  topLevelDeclarationCount: number;
  topLevelExecutableStatementCount: number;
  wildcardExportCount: number;
}

/** Re-export metadata collected from a source file's export declarations. */
export interface SourceFileReExport {
  isWildcard: boolean;
  resolvedPath: null | string;
  specifier: string;
}

/** Rule options for the too-many-internal-dependencies violation. */
export interface TooManyInternalDependenciesRuleConfig {
  maxImports?: number;
}
