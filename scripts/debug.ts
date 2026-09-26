import { HEISTS } from "../src/content/heists";
import { Level } from "../src/engine/geometry";
import { newGame, step } from "../src/engine/game";
import type { Action } from "../src/engine/types";
const id = process.argv[2];
const moves = process.argv[3] ?? "";
const h = HEISTS.find((x) => x.id === id)!;
const level = new Level(h.def);
let s = newGame(h.def);
for (const m of moves) {
  const r = step(level, s, m as Action);
  if (!r.ok) { console.log("refused", m, r.reason, "at", s.pos, "t", s.t); break; }
  s = r.state;
  console.log(m, "t", s.t, "pos", s.pos, s.status, s.caught ?? "");
  if (s.status !== "playing") break;
}
