/** Alias mapping derived from tsconfig/jsconfig path configuration. */
export interface AliasMapping {
  prefix: string;
  targetRoots: string[];
}

/** Configurable thresholds and discovery knobs for the architecture analyzer. */
export interface ArchitectureAnalyzerConfig {
  entrypointNames?: string[];
  ignoredDirectoryNames?: string[];
  maxSiblingImports?: number;
  minRepeatedDeepImports?: number;
  vendorManagedDirectoryNames?: string[];
}

/** Repository-wide discovery state reused by multiple architecture checks. */
export interface ArchitectureProject {
  aliasMappings: AliasMapping[];
  boundaries: BoundaryDirectory[];
  codeRoots: CodeRoots;
  config: Required<ArchitectureAnalyzerConfig>;
  directories: string[];
  files: string[];
  imports: ImportRecord[];
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

/** Resolved import metadata for a single source file import edge. */
export interface ImportRecord {
  resolvedPath: null | string;
  sourcePath: string;
  specifier: string;
}
