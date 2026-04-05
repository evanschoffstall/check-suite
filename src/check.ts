// ---------------------------------------------------------------------------
// Public API re-exports — import from sub-modules for tree-shaking; import
// from here for convenience when consuming the package as a library.
// The sole CLI entrypoint is bin/check-suite.
// ---------------------------------------------------------------------------

export { parseCliArguments } from "@/cli/args/parser.ts";
export { runInlineTypeScriptStep } from "@/inline-ts/runner.ts";
export { runStepPostProcess } from "@/post-process/runner.ts";
export { applyOutputFilter } from "@/process/output.ts";
export { run } from "@/process/runner.ts";
export { runStepWithinDeadline } from "@/step/deadline.ts";
export { runStepBatch } from "@/suite-processing/batch.ts";
export { runCheckSuite } from "@/suite-processing/runner.ts";
export { buildSummary } from "@/summary/build.ts";
export { compactDomAssertionNoise } from "@/summary/dom.ts";
export { resolveTimeoutMs } from "@/timeout/resolution.ts";
