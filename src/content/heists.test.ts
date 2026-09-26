import { describe, expect, it } from "vitest";
import { HEISTS } from "./heists";
import { validateVault } from "@/engine/validate";
import { solve } from "@/engine/solver";

describe("tutorial heists", () => {
  it("have unique ids and ascending numbers", () => {
    expect(new Set(HEISTS.map((h) => h.id)).size).toBe(HEISTS.length);
    HEISTS.forEach((h, i) => expect(h.n).toBe(i + 1));
  });

  for (const h of HEISTS) {
    it(`${h.n}. ${h.title} is valid and crackable`, () => {
      const v = validateVault(h.def);
      expect(v.problems).toEqual([]);
      const r = solve(h.def, { maxStates: 500_000 });
      expect(r.status).toBe("solved");
      if (r.status === "solved") expect(r.turns).toBeGreaterThanOrEqual(15);
    });
  }
});
