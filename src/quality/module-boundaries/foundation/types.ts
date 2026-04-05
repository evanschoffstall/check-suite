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
  dependencyPolicies?: ArchitectureDependencyPolicy[];
  entrypointNames?: string[];
  explicitPublicSurfacePaths?: string[];
  ignoredDirectoryNames?: string[];
  includeRootFiles?: boolean;
  junkDrawerDirectoryNames?: string[];
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
  requireAcyclicDependencyPolicies?: boolean;
  requireCompleteDependencyPolicyCoverage?: boolean;
  requireTypeOnlyImportsForTypeOnlyPolicies?: boolean;
  rootDirectories?: string[];
  sharedHomeNames?: string[];
  testDirectoryNames?: string[];
  vendorManagedDirectoryNames?: string[];
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

/** A normalized layer family used for generic dependency-direction checks. */
export interface ArchitectureLayerGroup {
  name: string;
  patterns: string[];
}

/** Repository-wide discovery state reused by multiple architecture checks. */
export interface ArchitectureProject {
  aliasMappings: AliasMapping[];
  boundaries: BoundaryDirectory[];
  codeRoots: CodeRoots;
  config: Required<ArchitectureAnalyzerConfig>;
  directories: string[];
  directoryFacts: DirectoryFacts[];
  files: string[];
  imports: ImportRecord[];
  sourceFacts: SourceFileFacts[];
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

/** A top-level code root discovered from the current repository layout. */
export interface CodeRoots {
  directories: string[];
  files: string[];
}

/** Aggregated code-layout facts for a single directory. */
export interface DirectoryFacts {
  childDirectoryPaths: string[];
  codeFilePaths: string[];
  entrypointPaths: string[];
  path: string;
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
