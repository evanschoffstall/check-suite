// ---------------------------------------------------------------------------
// Public API re-exports — import from sub-modules for tree-shaking; import
// from here for convenience and backward compatibility.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dev script entry guard — `bun src/check.ts [args]`
// ---------------------------------------------------------------------------

import { main } from "./cli/command-line-interface.ts";

export { parseCliArguments } from "./cli/args.ts";
export { runInlineTypeScriptStep } from "./inline-ts.ts";
export { runStepPostProcess } from "./post-process.ts";
export { applyOutputFilter, run } from "./process.ts";
export { runStepWithinDeadline } from "./step.ts";
export { runCheckSuite, runStepBatch } from "./suite.ts";
export { buildSummary, compactDomAssertionNoise } from "./summary.ts";
export { resolveTimeoutMs } from "./timeout.ts";

if (import.meta.main) void main();
