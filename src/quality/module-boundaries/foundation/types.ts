/** Alias mapping derived from tsconfig/jsconfig path configuration. */
export interface AliasMapping {
  prefix: string;
  targetRoots: string[];
}

/** Configurable thresholds and discovery knobs for the architecture analyzer. */
export interface ArchitectureAnalyzerConfig {
  entrypointNames?: string[];
  ignoredDirectoryNames?: string[];
  includeRootFiles?: boolean;
  junkDrawerDirectoryNames?: string[];
  junkDrawerFileStems?: string[];
  layerGroups?: ArchitectureLayerGroup[];
  maxEntrypointReExports?: number;
  maxInternalImportsPerFile?: number;
  maxSiblingImports?: number;
  minRepeatedDeepImports?: number;
  rootDirectories?: string[];
  sharedHomeNames?: string[];
  vendorManagedDirectoryNames?: string[];
}

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
  resolvedPath: null | string;
  sourcePath: string;
  specifier: string;
}

/** AST-derived source facts used by entrypoint and cohesion rules. */
export interface SourceFileFacts {
  directoryPath: string;
  exportModuleSpecifiers: string[];
  isEntrypoint: boolean;
  path: string;
  stem: string;
  topLevelDeclarationCount: number;
}
