import type { Dir } from "@/engine/types";
import { DIR_ANGLE } from "@/engine/geometry";

/**
 * Continuous rotation for anything that turns on a schedule (guards,
 * cameras). Instead of snapping 270° the long way from W to N, we unwrap the
 * whole cycle once, so turn t has a fixed angle that is always within ±180°
 * of turn t-1. Pure: no refs, no state.
 */
export function unwrapped(dirs: Dir[]): { prefix: number[]; loop: number } {
  const prefix: number[] = [];
  let acc = DIR_ANGLE[dirs[0]];
  prefix.push(acc);
  for (let i = 1; i <= dirs.length; i++) {
    const prev = dirs[i - 1];
    const cur = dirs[i % dirs.length];
    const delta = (((DIR_ANGLE[cur] - DIR_ANGLE[prev]) % 360) + 540) % 360 - 180;
    acc += delta;
    if (i < dirs.length) prefix.push(acc);
    else return { prefix, loop: acc - prefix[0] };
  }
  return { prefix, loop: 0 };
}

export function angleAt(u: { prefix: number[]; loop: number }, t: number): number {
  const n = u.prefix.length;
  const loops = Math.floor(t / n);
  return u.prefix[((t % n) + n) % n] + loops * u.loop;
}
