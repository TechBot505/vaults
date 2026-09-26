import { HEISTS } from "../src/content/heists";
import { validateVault } from "../src/engine/validate";
import { solve, securityRating } from "../src/engine/solver";

for (const h of HEISTS) {
  const v = validateVault(h.def);
  if (!v.ok) {
    console.log(`${h.n} ${h.title}: INVALID`, v.problems.slice(0, 3));
    continue;
  }
  const t0 = Date.now();
  const r = solve(h.def, { maxStates: 2_000_000 });
  const ms = Date.now() - t0;
  if (r.status === "solved") {
    const s = securityRating(r.turns, r.explored, r.lowerBound);
    console.log(`${h.n} ${h.title}: par ${r.turns} (lb ${r.lowerBound}), explored ${r.explored} (${ms}ms) ${s.locks}🔒 ${r.moves}`);
  } else console.log(`${h.n} ${h.title}: ${r.status} explored ${r.explored} (${ms}ms)`);
}
