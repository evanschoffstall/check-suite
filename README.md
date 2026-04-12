<div align="center">

<br />

# check-suite

*A production-grade quality suite and statistical analysis platform driven by a thin config file.*

[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-runtime-F9F1E1?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh)
[![MIT License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

</div>

check-suite is an open-source quality suite runner for any repository. You drop a `check-suite.config.ts` into your project, wire up the steps you want, and get a single `bun check` command that runs your full quality pipeline — linting, testing, type coverage, complexity analysis, architecture boundary checks, duplicate detection, secret scanning, and anything else you can express as a shell command or inline TypeScript function.

The engine is entirely generic. It has no knowledge of any specific tool, linter, or analyzer. You declare the steps; check-suite handles concurrency, timeouts, serial groups, post-processing, output formatting, and reporting.

> [!TIP]
> check-suite is a strong fit for any repository where you want a single, consistent quality command that runs locally and in CI with identical behavior. The config file is TypeScript; the steps can wrap anything.

## Why it exists

- Replace a loose collection of CI scripts with a single, coherent local command.
- Run lint, tests, coverage, complexity, and architecture checks in parallel with sensible timeouts.
- Enforce architecture boundaries and complexity thresholds without tying your tooling to a specific linter or static analyzer.
- Post-process step output with typed inline TypeScript instead of fragile shell awk pipelines.
- Get a styled terminal summary or a plain-text report that CI can parse, all from the same command.
- Keep quality configuration as a thin, readable `check-suite.config.ts` rather than a maze of shell scripts.

## Highlights

| Capability | What it gives you |
| --- | --- |
| Unified step runner | One command runs every quality gate in the repo, locally and in CI. |
| Parallel execution | Steps run concurrently unless you opt into a serial group. |
| Step selection | Run a single step in isolation, exclude steps, or run only the summary. |
| Timeout management | Per-step timeouts with drain windows, env-var overrides, and readable messages. |
| Inline TypeScript post-processing | Write typed post-process functions directly in config; check-suite compiles and runs them. |
| Coverage analysis | Parse LCOV artifacts or console output with configurable path filters and thresholds. |
| Complexity analysis | Adapter-backed cyclomatic complexity and nesting depth checks across the full source tree. |
| Architecture boundary enforcement | Infer or declare module dependency policies and enforce them against the import graph. |
| Lint handler | Auto-derive worker count, file count, and glob patterns for any lint command. |
| Git file scanning | Run targeted checks only against files changed in the current branch. |
| Token resolution | Interpolate dynamic values into step configuration without hardcoding. |
| Plain and styled output | Full ANSI-styled terminal renderer for local use; plain-text mode for CI and scripts. |

## Quick start

### Prerequisites

- Bun

### 1. Install

```bash
bun add -d check-suite
```

### 2. Create a config

Add `check-suite.config.ts` to your project root. The config exports a `defineCheckSuiteConfig` call with an array of step declarations.

```ts
import { defineCheckSuiteConfig } from "check-suite/config-schema";
import { defineStep } from "check-suite/step";

export default defineCheckSuiteConfig([
  defineStep({
    args: ["eslint", "."],
    key: "lint",
    label: "lint",
  }),
  defineStep({
    args: ["tsc", "--noEmit"],
    cmd: "bun",
    key: "types",
    label: "types",
  }),
]);
```

> [!NOTE]
> `cmd` defaults to `bunx`. Override it to `"bun"` when running a Bun built-in like `tsc` through a local install.

### 3. Add the script

```json
{
  "scripts": {
    "check": "check-suite"
  }
}
```

### 4. Run it

```bash
bun check
```

### 5. Verify the install

You should see a step-by-step run with pass/fail status for each declared step, followed by a final summary line. Failures print the relevant output; passing steps stay collapsed.

> [!IMPORTANT]
> If a step fails immediately with a spawn error, verify the command is installed and reachable through `bunx` or the path you supplied to `cmd`.

## CLI reference

| Command | Purpose |
| --- | --- |
| `check-suite` | Run all enabled steps. |
| `check-suite summary` | Run all steps without detailed per-step output. |
| `check-suite keys` | List all enabled step keys. |
| `check-suite <step-key>` | Run a single step in isolation. |
| `check-suite help` | Print usage text. |

**Suite options:**

| Flag | Purpose |
| --- | --- |
| `--output=failures` | Show detailed output only for failing steps (default). |
| `--output=all` | Show detailed output for all steps. |
| `--format=plain` | Disable ANSI styling, animation, and decorative glyphs. |
| `--format=styled` | Use the default styled terminal renderer. |
| `--fail-lines=<n>` | Truncate each failing step's output to the first `n` lines. |
| `--no=<step-key>` | Exclude a step from the run. |
| `--<step-key>` | Run only the named step(s). |

## Configuration

### Step types

**`defineStep`** is the single entry point for all step shapes. The overload is discriminated from the input:

```ts
// Command step (subprocess) — cmd defaults to "bunx"
defineStep({ label: "knip", args: ["knip", "--config", "knip.json"] });

// Lint handler — auto-derives worker count and file glob
defineStep({ handler: "lint", label: "eslint", args: ["eslint", "--max-warnings", "0"] });

// Inline TypeScript step — source is compiled and run in-process
defineStep({ label: "check-css", key: "css", source: async ({ cwd }) => { /* ... */ } });
```

You can also import the lower-level factories directly when you need explicit control:

- `defineCommandStep` — subprocess steps
- `defineLintStep` — lint-handler steps with auto-concurrency
- `defineInlineStep` — in-process TypeScript steps

### Paths and tokens

Declare named paths and token values alongside steps. check-suite resolves `{tokenName}` interpolations in step args, timeout values, and post-process data at runtime.

```ts
defineCheckSuiteConfig([
  { paths: { coverage: "coverage/lcov.info" } },
  { suite: { tokens: { coverageThreshold: 80 } } },
  defineStep({ /* ... */ }),
]);
```

### Post-processing

Attach an inline TypeScript `postProcess` to any step to parse output, derive extra checks, or build a custom summary:

```ts
defineStep({
  args: ["custom-tool", "--json"],
  key: "custom",
  label: "custom",
  postProcess: {
    source: ({ displayOutput, helpers }) => {
      const count = (displayOutput.match(/error/g) ?? []).length;
      return { status: count === 0 ? "pass" : "fail", summary: `${count} errors` };
    },
  },
});
```

<details>
<summary>Advanced configuration options</summary>

- `serialGroup` — group steps that must not run concurrently (for example, test runners that share a port).
- `timeoutMs` / `timeoutEnvVar` / `timeoutDrainMs` — per-step timeout tuning with env-var overrides.
- `ensureDirs` — create output directories before the step runs (useful for report artifacts).
- `outputFilter` — strip matched lines from captured output before post-processing.
- `preRun` — mark a step as a dependency that runs before the main suite begins.
- `enabled` — statically or dynamically disable a step without removing it from config.

</details>

## Built-in analysis

### Complexity

`runComplexityCheck` and `createSpawnComplexityAdapter` plug any external complexity tool (or the built-in TypeScript analyzer) into the check-suite quality surface. Thresholds, file discovery, and violation formatting are all parameterized from config.

### Architecture boundaries

`runArchitectureCheck` and `discoverDefaultCodeRoots` analyze the import graph against declared or inferred dependency policies. Use `definePolicies` from `check-suite/recipes` to declare module ownership with minimal boilerplate:

```ts
import { definePolicies } from "check-suite/recipes";

const policies = definePolicies({
  cli:    { dependsOn: ["config", "types"] },
  config: { dependsOn: ["types"], tier: "public" },
  types:  { tier: "public" },
});
```

> [!TIP]
> When `dependsOn` and `dependents` are omitted, the analyzer infers allowed dependencies automatically from the directory layout. Start without explicit policies and tighten them once the graph stabilizes.

## Stack

| Layer | Technology |
| --- | --- |
| Runtime | Bun |
| Language | TypeScript 5 |
| Config validation | Zod |
| CLI | Native Bun process (no framework) |

## Project structure

```text
check-suite/
├── src/
│   ├── check.ts              # Public API re-exports
│   ├── cli/                  # Argument parsing and command dispatch
│   ├── config/               # Config loading and utilities
│   ├── config-schema/        # Zod-backed schema and defineCheckSuiteConfig
│   ├── format/               # Output formatting and tone
│   ├── foundation/           # Shared guards, glob, and low-level utilities
│   ├── inline-ts/            # In-process TypeScript compilation and runner
│   ├── post-process/         # Step output post-processing pipeline
│   ├── process/              # Subprocess spawning, I/O, and preflight checks
│   ├── quality/
│   │   ├── complexity/       # Cyclomatic complexity and nesting analysis
│   │   └── module-boundaries/# Architecture boundary enforcement
│   ├── recipes/              # High-level helpers (policy builder, etc.)
│   ├── runtime-config/       # Config file resolution and token state
│   ├── step/                 # Step factory functions and deadline runner
│   ├── suite-processing/     # Batch execution, selection, display, and reporting
│   ├── summary/              # Summary pattern matching and rendering
│   ├── timeout/              # Timeout resolution, delay, and messaging
│   └── types/                # Shared TypeScript types and step types
├── bin/
│   └── check-suite           # CLI entrypoint
├── tests/                    # Bun tests for platform internals
└── check-suite.config.ts     # This repository's own quality configuration
```

## Design principle

check-suite is built on a hard line between the generic engine and the user-supplied configuration. The `src/` directory is a runtime engine with zero knowledge of any specific tool, linter, analyzer, or project layout. It provides generic step builders, analysis engines, timeout handling, concurrency, and output formatting — all parameterized by config, never hardcoded.

`check-suite.config.ts` is the only place repository-specific knowledge lives. It stays under 200 lines by design: the primitives in `src/` are expressive enough that wiring a step, enforcing a boundary, or parsing tool output takes one or two lines of config.

> [!CAUTION]
> Do not move repository-specific logic into `src/`. If something is specific to a named tool, a project path, or a particular CLI flag set, it belongs in `check-suite.config.ts`, not in the platform. The engine must stay generic enough to serve any repository.

<div align="center">

Made with ❤️ by [Evan Schoffstall](https://github.com/evanschoffstall)

</div>
