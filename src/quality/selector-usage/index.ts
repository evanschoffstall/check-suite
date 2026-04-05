import type { join } from "node:path";

import { createSafeRegExp, isSafeRegExpPattern } from "@/regex.ts";

/** Result of a generic PurgeCSS analysis run. */
export type PurgeCssCheckResult =
  | { kind: "invalid-safelist"; message: string }
  | { kind: "ok"; unusedSelectors: string[] };

/** Runtime configuration for the generic PurgeCSS analysis. */
export interface PurgeCssConfig {
  contentGlobs: string[];
  cssFiles: string[];
  safelists: string[];
  selectorPrefix: string;
}

/**
 * Runs PurgeCSS against the configured content globs and returns only rejected
 * selectors that match the configured project-owned prefix.
 */
export async function analyzePurgeCss({
  config,
  cwd,
  importModule,
  joinPath,
}: {
  config: PurgeCssConfig;
  cwd: string;
  importModule: (specifier: string) => Promise<unknown>;
  joinPath: typeof join;
}): Promise<PurgeCssCheckResult> {
  const compiledSafelists = compileSafelists(config.safelists);
  if (!compiledSafelists) {
    return {
      kind: "invalid-safelist",
      message: "purgecss config contains an unsafe safelist pattern\n",
    };
  }

  const safeSelectorPattern = buildSafeSelectorPattern(compiledSafelists);
  const purgeCssModule = (await importModule("purgecss")) as {
    PurgeCSS: new () => {
      purge: (options: {
        content: string[];
        css: string[];
        rejected: boolean;
        safelist: { greedy: RegExp[] };
      }) => Promise<{ rejected?: string[] }[]>;
    };
  };
  const [result] = await new purgeCssModule.PurgeCSS().purge({
    content: config.contentGlobs.map((file) => joinPath(cwd, file)),
    css: config.cssFiles.map((file) => joinPath(cwd, file)),
    rejected: true,
    safelist: {
      greedy: compiledSafelists,
    },
  });

  return {
    kind: "ok",
    unusedSelectors: collectUnusedSelectors(
      result.rejected,
      config.selectorPrefix,
      safeSelectorPattern,
    ),
  };
}

export function formatUnusedSelectorOutput(unusedSelectors: string[]): string {
  return `${unusedSelectors.map((selector) => `  unused: ${selector}`).join("\n")}\nfound ${unusedSelectors.length} unused CSS selector(s)\n`;
}

export function readPurgeCssConfig(data: unknown): null | PurgeCssConfig {
  if (!isRecord(data)) {
    return null;
  }

  const cssFiles = data.cssFiles;
  const contentGlobs = data.contentGlobs;
  const safelists = data.safelists;
  const selectorPrefix = data.selectorPrefix;

  if (
    !isStringList(cssFiles) ||
    !isStringList(contentGlobs) ||
    !isStringList(safelists) ||
    typeof selectorPrefix !== "string"
  ) {
    return null;
  }

  return { contentGlobs, cssFiles, safelists, selectorPrefix };
}

function buildSafeSelectorPattern(safelists: RegExp[]): null | RegExp {
  return safelists.length > 0
    ? createSafeRegExp(safelists.map((pattern) => pattern.source).join("|"))
    : null;
}

function collectUnusedSelectors(
  rejectedSelectors: string[] | undefined,
  selectorPrefix: string,
  safeSelectorPattern: null | RegExp,
): string[] {
  if (!Array.isArray(rejectedSelectors)) {
    return [];
  }

  return rejectedSelectors.filter(
    (selector) =>
      selector.startsWith(selectorPrefix) &&
      !matchesSafelist(selector, safeSelectorPattern),
  );
}

function compileSafelists(safelists: string[]): null | RegExp[] {
  if (!safelists.every((pattern) => isSafeRegExpPattern(pattern))) {
    return null;
  }

  return safelists.map((pattern) => createSafeRegExp(pattern));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function matchesSafelist(
  selector: string,
  safeSelectorPattern: null | RegExp,
): boolean {
  return safeSelectorPattern ? safeSelectorPattern.test(selector) : false;
}
