import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PackageManifest } from "@/types/index.ts";

const PROJECT_MANIFEST: PackageManifest = (() => {
  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as PackageManifest;
  } catch {
    return {};
  }
})();

export const DECLARED_BUNX_TARGETS: Set<string> = (() => {
  const targets = new Set<string>();
  const dependencyNames = new Set<string>([
    ...Object.keys(PROJECT_MANIFEST.dependencies ?? {}),
    ...Object.keys(PROJECT_MANIFEST.devDependencies ?? {}),
    ...Object.keys(PROJECT_MANIFEST.optionalDependencies ?? {}),
    ...Object.keys(PROJECT_MANIFEST.peerDependencies ?? {}),
  ]);

  for (const dependencyName of dependencyNames) {
    targets.add(dependencyName);

    try {
      const packageJson = JSON.parse(
        readFileSync(
          join(process.cwd(), "node_modules", dependencyName, "package.json"),
          "utf8",
        ),
      ) as { bin?: Record<string, string> | string };

      if (typeof packageJson.bin === "string") {
        targets.add(
          dependencyName.includes("/")
            ? (dependencyName.split("/").at(-1) ?? dependencyName)
            : dependencyName,
        );
        continue;
      }

      for (const binName of Object.keys(packageJson.bin ?? {})) {
        targets.add(binName);
      }
    } catch {
      continue;
    }
  }

  return targets;
})();
