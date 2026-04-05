import type { Command, InlineTypeScriptContext } from "@/types/index.ts";

import { createSafeRegExp, isSafeRegExpPattern } from "@/regex.ts";

/**
 * Runs PurgeCSS against the configured content globs and reports only rejected
 * selectors that match the configured project-owned prefix.
 */
export async function purgeCssStep({
  cwd,
  data,
  fail,
  importModule,
  join,
  ok,
}: InlineTypeScriptContext): Promise<Command> {
  const config = readPurgeCssConfig(data);
  if (!config) {
    return fail("purgecss config is invalid\n");
  }

  const compiledSafelists = compileSafelists(config.safelists);
  if (!compiledSafelists) {
    return fail("purgecss config contains an unsafe safelist pattern\n");
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
    content: config.contentGlobs.map((file) => join(cwd, file)),
    css: config.cssFiles.map((file) => join(cwd, file)),
    rejected: true,
    safelist: {
      greedy: compiledSafelists,
    },
  });

  const unusedSelectors = collectUnusedSelectors(
    result.rejected,
    config.selectorPrefix,
    safeSelectorPattern,
  );

  if (unusedSelectors.length === 0) {
    return ok("no unused CSS selectors found\n");
  }

  return fail(formatUnusedSelectorOutput(unusedSelectors));
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

function formatUnusedSelectorOutput(unusedSelectors: string[]): string {
  return `${unusedSelectors.map((selector) => `  unused: ${selector}`).join("\n")}\nfound ${unusedSelectors.length} unused CSS selector(s)\n`;
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

function readPurgeCssConfig(data: InlineTypeScriptContext["data"]): null | {
  contentGlobs: string[];
  cssFiles: string[];
  safelists: string[];
  selectorPrefix: string;
} {
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
