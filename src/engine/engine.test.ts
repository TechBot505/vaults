import { describe, expect, it } from "vitest";
import { Level } from "./geometry";
import { newGame, run, step } from "./game";
import { fromAscii, makeRoute } from "./build";
import { solve } from "./solver";
import { validateVault } from "./validate";
import type { Action, GameState, VaultDef } from "./types";

const CORRIDOR = ["#########", "#E.....$#", "#########"];

function play(def: VaultDef, moves: string) {
  return run(new Level(def), moves);
}

describe("movement and escape", () => {
  it("walks to the loot and back out", () => {
    const def = fromAscii(["#######", "#E...$#", "#######"]);
    const r = play(def, "RRRRLLLL");
    expect(r.status).toBe("cracked");
    expect(r.state.loot).toEqual([true]);
    expect(r.state.t).toBe(8);
  });

  it("needs every piece of loot before the exit counts", () => {
    const def = fromAscii(["#######", "#$E..$#", "#######"]);
    expect(play(def, "RRRLLL").status).toBe("playing");
    expect(play(def, "RRRLLLL" + "R").status).toBe("cracked");
  });

  it("refuses walls without spending a turn", () => {
    const def = fromAscii(CORRIDOR);
    const level = new Level(def);
    const s = newGame(def);
    const r = step(level, s, "U");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked");
  });

  it("locks doors until you hold the matching keycard", () => {
    const withKey = fromAscii(["#########", "#E.r.R.$#", "#########"]);
    expect(play(withKey, "RRRRRR" + "LLLLLL").status).toBe("cracked");
    const noKey = fromAscii(["#########", "#E..R.r$#", "#########"]);
    const r = play(noKey, "RRRR");
    expect(r.invalidAt).toBe(2);
    expect(r.state.pos).toEqual({ x: 3, y: 1 });
  });

  it("flags trailing moves after the game ended and bad characters", () => {
    const def = fromAscii(["#######", "#E...$#", "#######"]);
    expect(play(def, "RRRRLLLLR").invalidAt).toBe(8);
    expect(play(def, "RRX").invalidAt).toBe(2);
  });

  it("is deterministic", () => {
    const def = fromAscii(CORRIDOR, { guards: [{ id: "g", waypoints: [{ x: 6, y: 1 }, { x: 3, y: 1 }], mode: "pingpong", range: 2 }] });
    const a = play(def, "RRWWRRLL");
    const b = play(def, "RRWWRRLL");
    expect(a).toEqual(b);
  });
});

describe("sight", () => {
  it("widens the cone every two tiles", () => {
    const def = fromAscii(["...........", "...........", "...........", "...........", "...........", "...........", "E.........$"]);
    const level = new Level(def);
    const tiles = level.sight(2, 3, "E", 4).map((i) => [i % def.w, Math.floor(i / def.w)]);
    expect(tiles).toEqual([
      [3, 3],
      [4, 2], [4, 3], [4, 4],
      [5, 2], [5, 3], [5, 4],
      [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    ]);
  });

  it("is blocked by walls and by doors", () => {
    const def = fromAscii(["#########", "#E..#...#", "#.R.....#", "#r.....$#", "#########"]);
    const level = new Level(def);
    expect(level.clearLine(1, 1, 3, 1)).toBe(true);
    expect(level.clearLine(1, 1, 5, 1)).toBe(false); // wall at (4,1)
    expect(level.clearLine(1, 2, 3, 2)).toBe(false); // door at (2,2)
  });

  it("can't see through the crack where two wall corners touch", () => {
    const def = fromAscii(["E#...", "#....", "....$"]);
    const level = new Level(def);
    expect(level.clearLine(0, 0, 1, 1)).toBe(false);
    expect(level.clearLine(2, 0, 3, 1)).toBe(true);
  });

  it("guards catch you in their cone", () => {
    const def = fromAscii(CORRIDOR, { guards: [{ id: "g", waypoints: [{ x: 7, y: 1, look: ["W"], wait: 1 }], range: 3 }] });
    // guard at (7,1) facing W sees (6,1)(5,1)(4,1)
    const r = play(def, "RRR");
    expect(r.status).toBe("caught");
    expect(r.state.caught).toEqual({ kind: "guard", id: "g" });
    expect(r.state.pos).toEqual({ x: 4, y: 1 });
    expect(play(def, "RR").status).toBe("playing");
  });

  it("a guard stepping onto you catches you", () => {
    const def = fromAscii(CORRIDOR);
    def.guards = [{ id: "g", range: 1, armored: false, route: [{ x: 4, y: 1, d: "N" }, { x: 3, y: 1, d: "W" }] }];
    const r = play(def, "RR");
    expect(r.status).toBe("caught");
    expect(r.state.caught).toEqual({ kind: "guard", id: "g" });
  });
});

describe("takedowns and bodies", () => {
  const base = () =>
    fromAscii(["##########", "#E......$#", "##########"], {
      guards: [{ id: "g", waypoints: [{ x: 3, y: 1, look: ["E"], wait: 1 }], range: 2 }],
      cameras: [{ id: "c", x: 3, y: 0, dirs: ["N", "N", "N", "S"], range: 1 }],
    });

  it("knocks out a guard from behind and leaves a body", () => {
    const def = base();
    def.cameras = [];
    const r = play(def, "RR");
    expect(r.status).toBe("playing");
    expect(r.state.down).toEqual(["g"]);
    expect(r.state.bodies).toEqual([{ x: 3, y: 1, guard: "g" }]);
  });

  it("a body in view raises the alarm", () => {
    const r = play(base(), "RRR");
    expect(r.status).toBe("caught");
    expect(r.state.caught).toEqual({ kind: "body", id: "g", seenBy: "c" });
  });

  it("armored guards can't be taken down", () => {
    const def = base();
    def.cameras = [];
    def.guards[0].armored = true;
    const r = play(def, "RR");
    expect(r.status).toBe("caught");
    expect(r.state.caught).toEqual({ kind: "armored", id: "g" });
  });
});

describe("cameras, lasers and EMP", () => {
  it("cameras sweep on schedule", () => {
    const def = fromAscii(["#######", "#E...$#", "#######"], { cameras: [{ id: "c", x: 3, y: 0, dirs: ["S", "N"], range: 1 }] });
    // t=1 camera faces N; t=2 faces S: stepping onto (3,1) so you arrive at t=2 = caught
    expect(play(def, "RR").state.caught).toEqual({ kind: "camera", id: "c" });
    // arrive at (3,1) on an odd turn instead
    const safe = play(def, "WRRRLL");
    expect(safe.status).toBe("playing");
  });

  it("lasers follow their pattern", () => {
    const def = fromAscii(["#######", "#E...$#", "#######"], { lasers: [{ id: "l", a: { x: 3, y: 1 }, b: { x: 3, y: 1 }, pattern: "10" }] });
    expect(play(def, "RR").state.caught).toEqual({ kind: "laser", id: "l" });
    expect(play(def, "WRR").status).toBe("playing");
  });

  it("EMP switches cameras and lasers off for three turns", () => {
    const def = fromAscii(["#######", "#E...$#", "#######"], { lasers: [{ id: "l", a: { x: 3, y: 1 }, b: { x: 3, y: 1 }, pattern: "1" }], emp: 1 });
    expect(play(def, "RR").status).toBe("caught");
    const r = play(def, "ERRR");
    expect(r.status).toBe("playing");
    expect(r.state.empLeft).toBe(0);
    // coming back after the EMP wears off: laser is live again
    expect(play(def, "ERRRRLL").state.caught).toEqual({ kind: "laser", id: "l" });
    // a second EMP is refused
    const level = new Level(def);
    const s = play(def, "E").state;
    const r2 = step(level, s, "E");
    expect(r2.ok).toBe(false);
  });

  it("the police arrive when the clock runs out", () => {
    const def = fromAscii(["#######", "#E...$#", "#######"], { maxTurns: 3 });
    const r = play(def, "RRR");
    expect(r.state.caught).toEqual({ kind: "timeout" });
    const ok = fromAscii(["#######", "#E...$#", "#######"], { maxTurns: 8 });
    expect(play(ok, "RRRRLLLL").status).toBe("cracked");
  });
});

describe("patrol routes", () => {
  const walk = (def: VaultDef) => (x: number, y: number) => def.tiles[y * def.w + x] === ".";
  it("builds loops of adjacent steps that face the way they walk", () => {
    const def = fromAscii(["#######", "#E...$#", "#.....#", "#######"]);
    const route = makeRoute([{ x: 1, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 1 }], walk(def), def.w, def.h, "loop")!;
    expect(route[0]).toEqual({ x: 1, y: 2, d: "E" });
    for (let i = 0; i < route.length; i++) {
      const a = route[i];
      const b = route[(i + 1) % route.length];
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    }
  });

  it("ping-pongs back along the same path and honors waits", () => {
    const def = fromAscii(["#######", "#E...$#", "#######"]);
    const route = makeRoute([{ x: 2, y: 1 }, { x: 4, y: 1, wait: 2, look: ["N", "S"] }], walk(def), def.w, def.h, "loop")!;
    expect(route.map((s) => `${s.x}${s.d}`)).toEqual(["2E", "3E", "4E", "4N", "4S", "3W"]);
  });
});

describe("validation", () => {
  it("accepts a well-formed vault", () => {
    expect(validateVault(fromAscii(["#######", "#E...$#", "#######"])).ok).toBe(true);
  });

  it("rejects broken vaults with useful messages", () => {
    const def = fromAscii(["#######", "#E..R$#", "#######"]);
    const r = validateVault(def);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.map((p) => p.code)).toContain("door");

    const watched = fromAscii(CORRIDOR, { guards: [{ id: "g", waypoints: [{ x: 3, y: 1, look: ["W"], wait: 1 }], range: 3 }] });
    const r2 = validateVault(watched);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.problems[0].code).toBe("entry");

    const cam = fromAscii(CORRIDOR, { cameras: [{ id: "c", x: 3, y: 1, dirs: ["E"] }] });
    const r3 = validateVault(cam);
    expect(r3.ok).toBe(false);

    expect(validateVault({ v: 2 }).ok).toBe(false);
    expect(validateVault({ ...fromAscii(CORRIDOR), tiles: "###" }).ok).toBe(false);
  });
});

describe("the Machine", () => {
  it("finds the shortest heist", () => {
    const r = solve(fromAscii(["#######", "#E...$#", "#######"]));
    expect(r.status).toBe("solved");
    if (r.status === "solved") expect(r.moves).toBe("RRRRLLLL");
  });

  it("waits for a patrol when it has to", () => {
    const def = fromAscii(["#########", "#E......#", "####.####", "####$####", "#########"], {
      guards: [{ id: "g", waypoints: [{ x: 7, y: 1 }, { x: 3, y: 1 }], mode: "loop", range: 1 }],
    });
    const r = solve(def);
    expect(r.status).toBe("solved");
    if (r.status === "solved") expect(play(def, r.moves).status).toBe("cracked");
  });

  it("proves impossibility", () => {
    const r = solve(fromAscii(["#######", "#E.#.$#", "#######"]));
    expect(r.status).toBe("impossible");
  });

  it("matches brute force on small random vaults", () => {
    let rnd = 12345;
    const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    let compared = 0;
    for (let trial = 0; trial < 40; trial++) {
      const rows = ["#######"];
      for (let y = 1; y < 4; y++) {
        let row = "#";
        for (let x = 1; x < 6; x++) row += rand() < 0.15 ? "#" : ".";
        rows.push(row + "#");
      }
      rows.push("#######");
      const g = (s: string, x: number, c: string) => s.slice(0, x) + c + s.slice(x + 1);
      rows[1] = g(rows[1], 1, "E");
      rows[2] = g(rows[2], 3, "$");
      let def: VaultDef;
      try {
        def = fromAscii(rows, {
          lasers: rand() < 0.7 ? [{ id: "l", a: { x: 2, y: 1 }, b: { x: 2, y: 3 }, pattern: rand() < 0.5 ? "10" : "110" }] : [],
          cameras: rand() < 0.6 ? [{ id: "c", x: 4, y: 0, dirs: ["S", "W", "E"], range: 2 }] : [],
        });
      } catch {
        continue;
      }
      if (!validateVault(def).ok) continue;
      const level = new Level(def);
      const LIMIT = 8;
      let best: number | null = null;
      const dfs = (s: GameState, depth: number) => {
        if (best !== null && depth >= best) return;
        if (depth >= LIMIT) return;
        for (const a of ["U", "R", "D", "L", "W"] as Action[]) {
          const r = step(level, s, a);
          if (!r.ok || r.state.status === "caught") continue;
          if (r.state.status === "cracked") {
            best = depth + 1;
            continue;
          }
          dfs(r.state, depth + 1);
        }
      };
      dfs(newGame(def), 0);
      const sol = solve(def);
      if (best !== null) {
        compared++;
        expect(sol.status).toBe("solved");
        if (sol.status === "solved") expect(sol.turns).toBe(best);
      } else if (sol.status === "solved") {
        expect(sol.turns).toBeGreaterThan(LIMIT);
      }
    }
    // make sure the comparison actually exercised solvable vaults
    expect(compared).toBeGreaterThan(8);
  });
});

describe("fuzzing", () => {
  it("never throws and keeps its invariants on random play", () => {
    let rnd = 99;
    const rand = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const def = fromAscii(
      ["############", "#E....#...$#", "#.##.r#.##.#", "#....R.....#", "#.##.#.##.$#", "#....#.....#", "############"],
      {
        guards: [
          { id: "a", waypoints: [{ x: 6, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 5 }, { x: 6, y: 5 }], range: 3 },
          { id: "b", waypoints: [{ x: 1, y: 5 }, { x: 4, y: 5 }], mode: "pingpong", range: 2, armored: true },
        ],
        cameras: [{ id: "c", x: 6, y: 0, dirs: ["S", "S", "E", "W"], range: 3 }],
        lasers: [{ id: "l", a: { x: 7, y: 1 }, b: { x: 9, y: 1 }, pattern: "1100" }],
        emp: 2,
        maxTurns: 120,
      },
    );
    expect(validateVault(def).ok).toBe(true);
    const level = new Level(def);
    for (let game = 0; game < 300; game++) {
      let s = newGame(def);
      let accepted = 0;
      for (let i = 0; i < 150 && s.status === "playing"; i++) {
        const a = "UDLRWE"[Math.floor(rand() * 6)] as Action;
        const r = step(level, s, a);
        if (!r.ok) {
          expect(["blocked", "locked", "no-emp"]).toContain(r.reason);
          continue;
        }
        accepted++;
        expect(r.state.t).toBe(s.t + 1);
        expect(r.state.moves.length).toBe(accepted);
        s = r.state;
      }
      // replaying the accepted moves reproduces the exact state
      const replay = run(level, s.moves);
      expect(replay.state).toEqual(s);
    }
  });
});
