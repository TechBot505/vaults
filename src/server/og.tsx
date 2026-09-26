import "server-only";
import { ImageResponse } from "next/og";
import { Level, cameraDir, guardStep, laserPhaseOn } from "@/engine/geometry";
import { watchedBy, worldAt } from "@/engine/game";
import type { VaultDef } from "@/engine/types";
import { floorFill, laserGeom, wallFill, wallOutline } from "@/components/board/scene";

export const OG_SIZE = { width: 1200, height: 630 };

const C = { ink: "#050d19", ink2: "#0a1628", ink3: "#10213a", paper: "#dcecff", dim: "#7f9bbd", faint: "#3a5578", line: "#17304f", cyan: "#5fd4ff", mint: "#4dffb8", gold: "#ffc94a", alarm: "#ff4d5e", amber: "#ffb020", laser: "#ff3dd5" };
const KEY: Record<string, string> = { red: "#ff5a5a", blue: "#4d9dff", gold: "#ffcf4d" };
const ANG: Record<string, number> = { E: 0, S: 90, W: 180, N: 270 };

/** The vault at turn 0 as a standalone SVG (for social cards). */
export function blueprintSvg(def: VaultDef): string {
  const level = new Level(def);
  const world = worldAt(level, 0, [], -1);
  const pad = 0.6;
  const watched = new Map<number, string>();
  for (const s of watchedBy(level, world)) for (const i of s.tiles) if (!watched.has(i)) watched.set(i, s.kind === "guard" ? C.alarm : C.amber);
  const parts: string[] = [];
  parts.push(`<defs><filter id="g" x="-2" y="-2" width="${def.w + 4}" height="${def.h + 4}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="0.12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`);
  parts.push(`<path d="${floorFill(level)}" fill="${C.ink3}" opacity="0.7"/>`);
  parts.push(`<path d="${wallFill(level)}" fill="#07172a"/>`);
  for (const [i, col] of watched) parts.push(`<rect x="${(i % def.w) + 0.04}" y="${Math.floor(i / def.w) + 0.04}" width="0.92" height="0.92" rx="0.08" fill="${col}" opacity="0.22"/>`);
  parts.push(`<path d="${wallOutline(level)}" stroke="${C.cyan}" stroke-width="0.07" stroke-linecap="square" fill="none" filter="url(#g)"/>`);
  parts.push(`<rect x="${def.entry.x + 0.08}" y="${def.entry.y + 0.08}" width="0.84" height="0.84" fill="none" stroke="${C.mint}" stroke-width="0.05" stroke-dasharray="0.12 0.08"/>`);
  def.lasers.forEach((l) => {
    const g = laserGeom(level, l);
    const on = laserPhaseOn(l, 0);
    parts.push(`<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke="${C.laser}" stroke-width="${on ? 0.09 : 0.03}" opacity="${on ? 1 : 0.35}" stroke-linecap="round" filter="url(#g)"/>`);
  });
  for (const d of def.doors) parts.push(`<rect x="${d.x + 0.3}" y="${d.y + 0.3}" width="0.4" height="0.4" rx="0.06" fill="${KEY[d.color]}"/>`);
  for (const k of def.keys) parts.push(`<rect x="${k.x + 0.3}" y="${k.y + 0.37}" width="0.4" height="0.26" rx="0.05" fill="${KEY[k.color]}"/>`);
  for (const l of def.loot) parts.push(`<path transform="translate(${l.x + 0.5} ${l.y + 0.5})" d="M0 -0.3L0.26 0L0 0.3L-0.26 0Z" fill="${C.gold}" filter="url(#g)"/>`);
  for (const c of def.cameras) {
    const d = cameraDir(c, 0);
    parts.push(`<g transform="translate(${c.x + 0.5} ${c.y + 0.5}) rotate(${ANG[d]})"><rect x="-0.2" y="-0.13" width="0.3" height="0.26" rx="0.05" fill="${C.ink2}" stroke="${C.amber}" stroke-width="0.05"/><path d="M0.1 -0.09L0.3 -0.15V0.15L0.1 0.09Z" fill="${C.amber}"/></g>`);
  }
  for (const g of def.guards) {
    const s = guardStep(g, 0);
    parts.push(
      `<g transform="translate(${s.x + 0.5} ${s.y + 0.5}) rotate(${ANG[s.d]})"><circle r="0.25" fill="${C.ink}" stroke="${C.alarm}" stroke-width="0.06" filter="url(#g)"/><path d="M0.05 -0.13L0.2 0L0.05 0.13" fill="none" stroke="${C.alarm}" stroke-width="0.07" stroke-linecap="round"/></g>`,
    );
  }
  parts.push(`<circle cx="${def.entry.x + 0.5}" cy="${def.entry.y + 0.5}" r="0.24" fill="${C.mint}" filter="url(#g)"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${def.w + pad * 2} ${def.h + pad * 2}" width="${(def.w + pad * 2) * 40}" height="${(def.h + pad * 2) * 40}">${parts.join("")}</svg>`;
}

function dataUri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function vaultCard(opts: { def: VaultDef; kicker: string; title: string; byline?: string; stat: string; statTone?: "alarm" | "gold" | "paper"; locks?: number }) {
  const { def } = opts;
  const maxW = 620;
  const maxH = 470;
  const scale = Math.min(maxW / (def.w + 1.2), maxH / (def.h + 1.2));
  const tone = opts.statTone === "alarm" ? C.alarm : opts.statTone === "gold" ? C.gold : C.paper;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: C.ink,
          backgroundImage: `linear-gradient(${C.line}55 1px, transparent 1px), linear-gradient(90deg, ${C.line}55 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          padding: 56,
          color: C.paper,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 470, paddingRight: 24 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: C.cyan }}>{opts.kicker}</div>
            <div style={{ display: "flex", fontSize: opts.title.length > 22 ? 52 : 66, fontWeight: 700, lineHeight: 1.02, marginTop: 18 }}>{opts.title}</div>
            {opts.byline && <div style={{ display: "flex", fontSize: 26, color: C.dim, marginTop: 16 }}>{opts.byline}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {opts.locks ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ width: 26, height: 26, borderRadius: 6, border: `3px solid ${i <= opts.locks! ? C.gold : C.faint}`, background: i <= opts.locks! ? `${C.gold}33` : "transparent" }} />
                ))}
              </div>
            ) : null}
            <div style={{ display: "flex", fontSize: 34, color: tone }}>{opts.stat}</div>
            <div style={{ display: "flex", fontSize: 24, color: C.faint, marginTop: 14, letterSpacing: 4 }}>VAULTS · CAN YOU CRACK IT?</div>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={dataUri(blueprintSvg(def))} width={Math.round((def.w + 1.2) * scale)} height={Math.round((def.h + 1.2) * scale)} />
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
