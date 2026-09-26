import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { validateVault } from "@/engine/validate";
import type { VaultDef } from "@/engine/types";

/**
 * Vaults can travel inside a URL: no account or database needed. The payload
 * is re-validated on the way in, so a hand-edited link can't crash anything.
 */

export interface SharedVault {
  def: VaultDef;
  title: string;
  /** the builder's crack, shown as "par" once someone beats it */
  par?: number;
}

export function encodeVault(v: SharedVault): string {
  return compressToEncodedURIComponent(JSON.stringify({ d: v.def, t: v.title.slice(0, 60), p: v.par }));
}

export function decodeVault(code: string): SharedVault | null {
  try {
    const raw = decompressFromEncodedURIComponent(code);
    if (!raw) return null;
    const o = JSON.parse(raw) as { d?: unknown; t?: unknown; p?: unknown };
    const r = validateVault(o.d);
    if (!r.ok) return null;
    const title = typeof o.t === "string" && o.t.trim() ? o.t.trim().slice(0, 60) : "A vault";
    const par = typeof o.p === "number" && Number.isInteger(o.p) && o.p > 0 ? o.p : undefined;
    return { def: r.def, title, par };
  } catch {
    return null;
  }
}
