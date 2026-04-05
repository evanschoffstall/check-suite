import type { Dirent } from "node:fs";

import { readdirSync } from "node:fs";

export function safeReadDir(directoryPath: string): Dirent[] {
  try {
    return readdirSync(directoryPath, {
      encoding: "utf8",
      withFileTypes: true,
    });
  } catch {
    return [];
  }
}
