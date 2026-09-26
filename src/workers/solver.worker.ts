/// <reference lib="webworker" />
import { solve } from "@/engine/solver";
import type { VaultDef } from "@/engine/types";

/**
 * The Machine runs off the main thread so the page never freezes while it
 * searches a big vault.
 */
let stop = false;

self.onmessage = (e: MessageEvent<{ type: "solve"; def: VaultDef; maxStates: number } | { type: "stop" }>) => {
  if (e.data.type === "stop") {
    stop = true;
    return;
  }
  stop = false;
  const { def, maxStates } = e.data;
  const result = solve(def, {
    maxStates,
    shouldStop: () => stop,
    onProgress: (explored) => (self as unknown as Worker).postMessage({ type: "progress", explored }),
  });
  (self as unknown as Worker).postMessage({ type: "done", result });
};
