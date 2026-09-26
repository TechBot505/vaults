"use client";

import { useEffect, useRef, useState } from "react";

/** Largest whole-pixel tile size that fits a w×h board into the element. */
export function useTileSize(w: number, h: number, opts: { max?: number; min?: number; pad?: number } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState(opts.max ?? 44);
  const { max = 56, min = 12, pad = 1.2 } = opts;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const t = Math.floor(Math.min(r.width / (w + pad), r.height / (h + pad)));
      setTile(Math.max(min, Math.min(max, t)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, max, min, pad]);
  return { ref, tile };
}
