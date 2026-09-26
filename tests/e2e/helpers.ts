import type { Page } from "@playwright/test";

const KEYS: Record<string, string> = { U: "ArrowUp", D: "ArrowDown", L: "ArrowLeft", R: "ArrowRight", W: " ", E: "e" };

/** Type a move string into a heist, respecting the input throttle. */
export async function play(page: Page, moves: string) {
  for (const m of moves) {
    await page.keyboard.press(KEYS[m]);
    await page.waitForTimeout(140);
  }
}

import { Level } from "../../src/engine/geometry";
import { newGame, step } from "../../src/engine/game";
import type { Action, GameState, VaultDef } from "../../src/engine/types";

/** Shortest move string that gets the thief caught (breadth-first). */
export function findCapture(def: VaultDef, maxDepth = 30): string {
  const level = new Level(def);
  let frontier: GameState[] = [newGame(def)];
  const seen = new Set<string>();
  for (let d = 0; d < maxDepth; d++) {
    const next: GameState[] = [];
    for (const s of frontier) {
      for (const a of ["U", "D", "L", "R", "W"] as Action[]) {
        const r = step(level, s, a);
        if (!r.ok) continue;
        if (r.state.status === "caught") return r.state.moves;
        if (r.state.status !== "playing") continue;
        const k = `${r.state.pos.x},${r.state.pos.y},${r.state.t % 64},${r.state.loot.join("")}`;
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(r.state);
      }
    }
    frontier = next;
  }
  return "";
}
