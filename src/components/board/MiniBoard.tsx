"use client";

import { useMemo } from "react";
import { Level } from "@/engine/geometry";
import type { VaultDef } from "@/engine/types";
import { Board } from "./Board";
import { sceneFor } from "./scene";

/** Static thumbnail of a vault at turn 0. */
export function MiniBoard({ def, maxW, maxH, t = 0 }: { def: VaultDef; maxW: number; maxH: number; t?: number }) {
  const level = useMemo(() => new Level(def), [def]);
  const scene = useMemo(() => sceneFor(level, null, t), [level, t]);
  const tile = Math.max(4, Math.floor(Math.min(maxW / (def.w + 1.2), maxH / (def.h + 1.2))));
  return <Board level={level} scene={scene} tile={tile} hideThief stepMs={0} ariaLabel="Vault preview" />;
}
