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
const DEFAULT_MAX_SIBLING_IMPORTS = 7;
const DEFAULT_MIN_REPEATED_DEEP_IMPORTS = 3;
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
  DEFAULT_MAX_SIBLING_IMPORTS,
  DEFAULT_MIN_REPEATED_DEEP_IMPORTS,
  DEFAULT_VENDOR_MANAGED_DIRECTORY_NAMES,
  TEST_DIRECTORY_NAMES,
  TEST_FILE_REGEX,
};
