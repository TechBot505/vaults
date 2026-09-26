"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SolveResult } from "@/engine/solver";
import type { VaultDef } from "@/engine/types";

export type MachineState =
  | { status: "idle" }
  | { status: "running"; explored: number }
  | { status: "done"; result: SolveResult; def: VaultDef };

/** Run the Machine in a Web Worker. */
export function useMachine() {
  const worker = useRef<Worker | null>(null);
  const [state, setState] = useState<MachineState>({ status: "idle" });

  useEffect(() => () => worker.current?.terminate(), []);

  const run = useCallback((def: VaultDef, maxStates = 600_000) => {
    worker.current?.terminate();
    const w = new Worker(new URL("../workers/solver.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    setState({ status: "running", explored: 0 });
    w.onmessage = (e: MessageEvent<{ type: "progress"; explored: number } | { type: "done"; result: SolveResult }>) => {
      if (e.data.type === "progress") setState({ status: "running", explored: e.data.explored });
      else {
        setState({ status: "done", result: e.data.result, def });
        w.terminate();
        if (worker.current === w) worker.current = null;
      }
    };
    w.onerror = () => {
      setState({ status: "done", result: { status: "gave-up", explored: 0 }, def });
      w.terminate();
    };
    w.postMessage({ type: "solve", def, maxStates });
  }, []);

  const cancel = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    setState({ status: "idle" });
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, cancel, reset };
}
