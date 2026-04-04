import type { PostProcessTone } from "@/types/index.ts";

import { ANSI } from "./base.ts";

/** Maps a post-process tone to the corresponding ANSI color code. */
export function getToneColor(tone: PostProcessTone | undefined): string {
  switch (tone) {
    case "fail": {
      return ANSI.red;
    }
    case "pass": {
      return ANSI.green;
    }
    case "warn": {
      return ANSI.yellow;
    }
    default: {
      return ANSI.gray;
    }
  }
}
