/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular-dependencies",
      severity: "error",
      comment:
        "Break circular references instead of normalizing them as a repository pattern.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "src-does-not-depend-on-check-suite-config",
      severity: "error",
      comment:
        "Runtime code must remain independent from the repo-owned suite configuration surface.",
      from: {
        path: "^src/",
      },
      to: {
        path: "^check-suite-config/",
      },
    },
    {
      name: "check-suite-config-imports-only-public-src-types",
      severity: "error",
      comment:
        "Suite config modules may consume the public src type surface, but not runtime internals.",
      from: {
        path: "^check-suite-config/",
      },
      to: {
        path: "^src/",
        pathNot: "^src/types/index\\.ts$",
      },
    },
    {
      name: "types-layer-is-foundational",
      severity: "error",
      comment:
        "Shared contracts stay at the bottom of the graph so higher layers cannot leak inward.",
      from: {
        path: "^src/types/",
      },
      to: {
        pathNot: "^src/types/",
      },
    },
    {
      name: "config-schema-stays-runtime-free",
      severity: "error",
      comment:
        "Schema validation can depend on contracts and pure helpers, not runtime execution layers.",
      from: {
        path: "^src/config-schema/",
      },
      to: {
        path: "^src/(cli|config|inline-ts|post-process-runner|process|step|suite-processing)/",
      },
    },
    {
      name: "config-stays-orchestration-free",
      severity: "error",
      comment:
        "Config loading may validate and read manifests, but it must not reach into execution or CLI layers.",
      from: {
        path: "^src/config/",
      },
      to: {
        path: "^src/(cli|post-process-runner|process|step|suite-processing)/",
      },
    },
    {
      name: "process-stays-execution-focused",
      severity: "error",
      comment:
        "Process primitives should not depend on orchestration or command selection layers.",
      from: {
        path: "^src/process/",
      },
      to: {
        path: "^src/(cli|inline-ts|post-process-runner|step|suite-processing)/",
      },
    },
    {
      name: "step-stays-below-cli-and-suite-processing",
      severity: "error",
      comment:
        "Step execution is a lower layer than CLI dispatch and suite orchestration.",
      from: {
        path: "^src/step/",
      },
      to: {
        path: "^src/(cli|suite-processing)/",
      },
    },
    {
      name: "post-process-stays-below-suite-processing",
      severity: "error",
      comment:
        "Post-process helpers can enrich results, but they must not depend on suite orchestration or CLI code.",
      from: {
        path: "^src/post-process-(result|runner)/",
      },
      to: {
        path: "^src/(cli|config|step|suite-processing)/",
      },
    },
    {
      name: "suite-processing-does-not-depend-on-cli",
      severity: "error",
      comment:
        "Suite orchestration is callable by the CLI, but it must not depend on CLI argument handling.",
      from: {
        path: "^src/suite-processing/",
      },
      to: {
        path: "^src/cli/",
      },
    },
  ],
  options: {
    combinedDependencies: true,
    doNotFollow: {
      path: "node_modules",
    },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    },
    includeOnly: "^(src|check-suite-config)(/|$)|^check-suite\\.config\\.ts$",
    tsConfig: {
      fileName: "tsconfig.json",
    },
    tsPreCompilationDeps: true,
  },
};
