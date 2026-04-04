const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const CODE_FILE_REGEX = /\.(?:[cm]?[jt]sx?)$/u;
const DECLARATION_FILE_REGEX = /\.d\.(?:[cm]?[jt]sx?)$/u;
const DEFAULT_ENTRYPOINT_NAMES = ["index", "mod"] as const;
const DEFAULT_IGNORED_DIRECTORY_NAMES = [
  ".cache",
  ".git",
  ".idea",
  ".next",
  ".turbo",
  ".vscode",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "tmp",
] as const;
const DEFAULT_JUNK_DRAWER_DIRECTORY_NAMES = [
  "common",
  "helpers",
  "misc",
  "shared",
  "temp",
  "tmp",
  "backup",
] as const;
const DEFAULT_JUNK_DRAWER_FILE_STEMS = [
  "common",
  "helper",
  "helpers",
  "misc",
  "shared",
  "temp",
  "tmp",
  "backup",
] as const;
const DEFAULT_LAYER_GROUPS = [
  {
    name: "foundation",
    patterns: [
      "types",
      "contracts",
      "constants",
      "schemas",
      "validators",
      "config",
    ],
  },
  {
    name: "shared",
    patterns: ["core", "lib", "utils", "shared"],
  },
  {
    name: "domain",
    patterns: ["domain", "entity", "entities", "model", "models"],
  },
  {
    name: "data",
    patterns: [
      "data",
      "db",
      "infra",
      "infrastructure",
      "repository",
      "repositories",
      "persistence",
    ],
  },
  {
    name: "services",
    patterns: [
      "service",
      "services",
      "process",
      "workflow",
      "workflows",
      "use-case",
      "use-cases",
      "runner",
      "runners",
    ],
  },
  {
    name: "features",
    patterns: ["feature", "features", "module", "modules"],
  },
  {
    name: "interface",
    patterns: [
      "ui",
      "component",
      "components",
      "view",
      "views",
      "page",
      "pages",
      "route",
      "routes",
      "app",
      "cli",
      "command",
      "commands",
      "api",
      "server",
      "presentation",
    ],
  },
] as const;
const DEFAULT_MAX_ENTRYPOINT_RE_EXPORTS = 12;
const DEFAULT_MAX_INTERNAL_IMPORTS = 12;
const DEFAULT_MAX_SIBLING_IMPORTS = 7;
const DEFAULT_MIN_REPEATED_DEEP_IMPORTS = 3;
const DEFAULT_SHARED_HOME_NAMES = ["types", "contracts", "utils"] as const;
const DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES = [
  "__generated__",
  "generated",
  "vendor",
] as const;
const TEST_DIRECTORY_NAMES = new Set([
  "__fixtures__",
  "__mocks__",
  "__tests__",
  "fixtures",
  "mocks",
  "test",
  "tests",
]);
const TEST_FILE_REGEX = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/u;

export {
  CODE_EXTENSIONS,
  CODE_FILE_REGEX,
  DECLARATION_FILE_REGEX,
  DEFAULT_ENTRYPOINT_NAMES,
  DEFAULT_IGNORED_DIRECTORY_NAMES,
  DEFAULT_JUNK_DRAWER_DIRECTORY_NAMES,
  DEFAULT_JUNK_DRAWER_FILE_STEMS,
  DEFAULT_LAYER_GROUPS,
  DEFAULT_MAX_ENTRYPOINT_RE_EXPORTS,
  DEFAULT_MAX_INTERNAL_IMPORTS,
  DEFAULT_MAX_SIBLING_IMPORTS,
  DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
  DEFAULT_SHARED_HOME_NAMES,
  DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES,
  TEST_DIRECTORY_NAMES,
  TEST_FILE_REGEX,
};
