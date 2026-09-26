"use client";

import { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** false during SSR and the hydration pass, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Live media-query match; false on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** A timestamp captured once per mount (keeps render pure). */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
