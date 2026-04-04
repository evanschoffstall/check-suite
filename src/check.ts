// ---------------------------------------------------------------------------
// Public API re-exports — import from sub-modules for tree-shaking; import
// from here for convenience when consuming the package as a library.
// The sole CLI entrypoint is bin/check-suite.
// ---------------------------------------------------------------------------

export { parseCliArguments } from "./cli/args.ts";
export { runInlineTypeScriptStep } from "./inline-ts/index.ts";
export { runStepPostProcess } from "./post-process-runner/index.ts";
export { run } from "./process/index.ts";
export { applyOutputFilter } from "./process/output.ts";
export { runStepWithinDeadline } from "./step/index.ts";
export { runCheckSuite, runStepBatch } from "./suite-processing/index.ts";
export { buildSummary, compactDomAssertionNoise } from "./summary.ts";
export { resolveTimeoutMs } from "./timeout.ts";
