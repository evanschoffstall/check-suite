import type { CheckConfig } from "../src/types.ts";

/** User-facing output paths exposed as `{token}` placeholders to step args. */
export const paths = {
	junitPath: "coverage/test-results.xml",
	lcovPath: "coverage/lcov.info",
	playwrightJunitPath: "coverage/playwright-junit.xml",
	playwrightLcovPath: "coverage/playwright/lcov.info",
} satisfies CheckConfig["paths"];

/** Suite-level timeout settings applied before any per-step timeout override. */
export const suite = {
	timeoutEnvVar: "CHECK_SUITE_TIMEOUT_MS",
	timeoutMs: 180000,
} satisfies NonNullable<CheckConfig["suite"]>;