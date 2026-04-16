import { isRecord } from "@/quality/module-boundaries/discovery/normalization.ts";

/** Flattens grouped discovery, policy, and rules config into the analyzer's normalized flat shape. */
export function flattenArchitectureConfigSections(
  value: unknown,
): Record<string, unknown> {
  const record = isRecord(value) ? value : {};
  const discovery = toConfigSectionRecord(record.discovery);
  const policy = toConfigSectionRecord(record.policy);
  const rules = toConfigSectionRecord(record.rules);
  const entrypoints = toConfigSectionRecord(policy.entrypoints);

  return {
    ...flattenDiscoverySection(discovery),
    ...flattenPolicySection(policy, entrypoints),
    ...flattenRulesSection(rules),
    ...record,
  };
}

function flattenBroadBarrelSurfaceRule(
  section: Record<string, unknown>,
): Record<string, unknown> {
  return {
    maxEntrypointReExports: section.maxReExports,
  };
}

function flattenCentralSurfaceBudgetRule(
  section: Record<string, unknown>,
): Record<string, unknown> {
  return {
    centralSurfacePathPrefixes: section.pathPrefixes,
    maxCentralSurfaceExports: section.maxExports,
  };
}

function flattenDependencyPolicyRules(
  coverage: Record<string, unknown>,
  cycle: Record<string, unknown>,
  fanOut: Record<string, unknown>,
  typeOnly: Record<string, unknown>,
): Record<string, unknown> {
  return {
    maxPolicyFanOut: fanOut.maxDependencies,
    requireAcyclicDependencyPolicies: cycle.enabled,
    requireCompleteDependencyPolicyCoverage: coverage.enabled,
    requireTypeOnlyImportsForTypeOnlyPolicies: typeOnly.enabled,
  };
}

function flattenDiscoverySection(
  section: Record<string, unknown>,
): Record<string, unknown> {
  return {
    codeTargets: section.codeTargets,
    ignoredDirectories: section.ignoredDirectories,
    rootDirectories: section.rootDirectories,
    testDirectories: section.testDirectories,
  };
}

function flattenImportRules(
  repeatedDeepImport: Record<string, unknown>,
  siblingImportCohesion: Record<string, unknown>,
  tooManyInternalDependencies: Record<string, unknown>,
): Record<string, unknown> {
  return {
    maxInternalImportsPerFile: tooManyInternalDependencies.maxImports,
    maxSiblingImports: siblingImportCohesion.maxSiblingImports,
    minRepeatedDeepImports: repeatedDeepImport.minImporters,
  };
}

function flattenNamingRules(
  junkDrawerDirectory: Record<string, unknown>,
  junkDrawerFile: Record<string, unknown>,
  mixedFileNameCase: Record<string, unknown>,
  rootFileOwnership: Record<string, unknown>,
  sharedHome: Record<string, unknown>,
): Record<string, unknown> {
  return {
    allowedRootFileStems: rootFileOwnership.allowedRootFileStems,
    enforceConsistentFileNameCase:
      mixedFileNameCase.enabled ?? Object.keys(mixedFileNameCase).length > 0,
    fileNameCaseIgnoreFileGlobs: mixedFileNameCase.ignoreFileGlobs,
    fileNameCaseIgnorePathGlobs: mixedFileNameCase.ignorePathGlobs,
    junkDrawerDirectoryNames: junkDrawerDirectory.directoryNames,
    junkDrawerFileNamePatterns: junkDrawerFile.fileNamePatterns,
    junkDrawerFileStems: junkDrawerFile.fileStems,
    sharedHomeNames: sharedHome.names,
  };
}

function flattenPolicySection(
  section: Record<string, unknown>,
  entrypoints: Record<string, unknown>,
): Record<string, unknown> {
  return {
    dependencyPolicies: section.dependencyPolicies,
    entrypointNames: entrypoints.names,
    entrypointRules: entrypoints.rules ?? section.entrypointRules,
    inferPolicies: section.infer,
    layerGroups: section.layerGroups,
  };
}

function flattenPublicSurfaceRules(
  centralSurfaceBudget: Record<string, unknown>,
  publicSurfacePurity: Record<string, unknown>,
  publicSurfaceReExportChain: Record<string, unknown>,
  publicSurfaceWildcardExport: Record<string, unknown>,
): Record<string, unknown> {
  return {
    allowedImpurePublicSurfacePaths: publicSurfacePurity.allowedPaths,
    allowPublicSurfaceReExportChains: publicSurfaceReExportChain.allow,
    explicitPublicSurfacePaths: publicSurfacePurity.explicitPaths,
    maxWildcardExportsPerPublicSurface:
      publicSurfaceWildcardExport.maxWildcardExports,
    ...flattenCentralSurfaceBudgetRule(centralSurfaceBudget),
  };
}

function flattenRulesSection(
  section: Record<string, unknown>,
): Record<string, unknown> {
  const broadBarrelSurface = toConfigSectionRecord(
    section["broad-barrel-surface"],
  );
  const dependencyPolicyRules = readDependencyPolicyRuleSections(section);
  const importRules = readImportRuleSections(section);
  const namingRules = readNamingRuleSections(section);
  const publicSurfaceRules = readPublicSurfaceRuleSections(section);
  const directoryDepth = toConfigSectionRecord(section["directory-depth"]);

  return {
    ...flattenBroadBarrelSurfaceRule(broadBarrelSurface),
    ...flattenDependencyPolicyRules(
      dependencyPolicyRules.coverage,
      dependencyPolicyRules.cycle,
      dependencyPolicyRules.fanOut,
      dependencyPolicyRules.typeOnly,
    ),
    ...flattenImportRules(
      importRules.repeatedDeepImport,
      importRules.siblingImportCohesion,
      importRules.tooManyInternalDependencies,
    ),
    ...flattenNamingRules(
      namingRules.junkDrawerDirectory,
      namingRules.junkDrawerFile,
      namingRules.mixedFileNameCase,
      namingRules.rootFileOwnership,
      namingRules.sharedHome,
    ),
    ...flattenPublicSurfaceRules(
      publicSurfaceRules.centralSurfaceBudget,
      publicSurfaceRules.publicSurfacePurity,
      publicSurfaceRules.publicSurfaceReExportChain,
      publicSurfaceRules.publicSurfaceWildcardExport,
    ),
    maxDirectoryDepth: directoryDepth.maxDepth,
  };
}

/** Groups dependency-policy rule sections so flattenRulesSection stays small. */
function readDependencyPolicyRuleSections(section: Record<string, unknown>): {
  coverage: Record<string, unknown>;
  cycle: Record<string, unknown>;
  fanOut: Record<string, unknown>;
  typeOnly: Record<string, unknown>;
} {
  return {
    coverage: toConfigSectionRecord(section["dependency-policy-coverage"]),
    cycle: toConfigSectionRecord(section["dependency-policy-cycle"]),
    fanOut: toConfigSectionRecord(section["dependency-policy-fan-out"]),
    typeOnly: toConfigSectionRecord(section["type-only-policy-import"]),
  };
}

/** Groups import-related rule sections so token-heavy lookups stay decomposed. */
function readImportRuleSections(section: Record<string, unknown>): {
  repeatedDeepImport: Record<string, unknown>;
  siblingImportCohesion: Record<string, unknown>;
  tooManyInternalDependencies: Record<string, unknown>;
} {
  return {
    repeatedDeepImport: toConfigSectionRecord(section["repeated-deep-import"]),
    siblingImportCohesion: toConfigSectionRecord(
      section["sibling-import-cohesion"],
    ),
    tooManyInternalDependencies: toConfigSectionRecord(
      section["too-many-internal-dependencies"],
    ),
  };
}

/** Groups naming and ownership rule sections so field mapping stays explicit. */
function readNamingRuleSections(section: Record<string, unknown>): {
  junkDrawerDirectory: Record<string, unknown>;
  junkDrawerFile: Record<string, unknown>;
  mixedFileNameCase: Record<string, unknown>;
  rootFileOwnership: Record<string, unknown>;
  sharedHome: Record<string, unknown>;
} {
  return {
    junkDrawerDirectory: toConfigSectionRecord(
      section["junk-drawer-directory"],
    ),
    junkDrawerFile: toConfigSectionRecord(section["junk-drawer-file"]),
    mixedFileNameCase: toConfigSectionRecord(section["mixed-file-name-case"]),
    rootFileOwnership: toConfigSectionRecord(section["root-file-ownership"]),
    sharedHome: toConfigSectionRecord(section["shared-home"]),
  };
}

/** Groups public-surface rule sections so flattening stays easy to audit. */
function readPublicSurfaceRuleSections(section: Record<string, unknown>): {
  centralSurfaceBudget: Record<string, unknown>;
  publicSurfacePurity: Record<string, unknown>;
  publicSurfaceReExportChain: Record<string, unknown>;
  publicSurfaceWildcardExport: Record<string, unknown>;
} {
  return {
    centralSurfaceBudget: toConfigSectionRecord(
      section["central-surface-budget"],
    ),
    publicSurfacePurity: toConfigSectionRecord(
      section["public-surface-purity"],
    ),
    publicSurfaceReExportChain: toConfigSectionRecord(
      section["public-surface-re-export-chain"],
    ),
    publicSurfaceWildcardExport: toConfigSectionRecord(
      section["public-surface-wildcard-export"],
    ),
  };
}

function toConfigSectionRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
