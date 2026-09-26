"use client";

import type { ReactNode } from "react";
import { MousePointer2, Eraser, LogIn, Gem, KeyRound, DoorClosed, Cctv, Zap, Square, SquareDashed, Grid3x3 } from "lucide-react";
import type { KeyColor } from "@/engine/types";
import { useEditor, type Tool } from "@/editor/store";

export interface ToolInfo {
  id: Tool;
  label: string;
  key: string;
  icon: ReactNode;
  hint: string;
}

function GuardIcon() {
  return (
    <svg width="16" height="16" viewBox="-1 -1 2 2" aria-hidden>
      <circle r="0.6" fill="none" stroke="currentColor" strokeWidth="0.16" />
      <path d="M0.05 -0.32L0.4 0L0.05 0.32" fill="none" stroke="currentColor" strokeWidth="0.16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const TOOLS: ToolInfo[] = [
  { id: "select", label: "Select", key: "v", icon: <MousePointer2 size={16} />, hint: "Click a guard, camera or laser to edit it." },
  { id: "wall", label: "Wall", key: "b", icon: <Square size={16} />, hint: "Drag to draw walls. Start on a wall to knock walls down instead." },
  { id: "floor", label: "Floor", key: "f", icon: <Grid3x3 size={16} />, hint: "Drag to lay floor." },
  { id: "void", label: "Outside", key: "o", icon: <SquareDashed size={16} />, hint: "Cut away tiles to shape the building. Outside blocks movement and sight." },
  { id: "entry", label: "Entrance", key: "n", icon: <LogIn size={16} />, hint: "The thief starts here and must escape through it." },
  { id: "loot", label: "Loot", key: "l", icon: <Gem size={16} />, hint: "Up to 5 pieces. The thief needs all of them." },
  { id: "key", label: "Keycard", key: "k", icon: <KeyRound size={16} />, hint: "Picking one up opens every door of its color." },
  { id: "door", label: "Door", key: "d", icon: <DoorClosed size={16} />, hint: "Locked until the thief holds the matching keycard. Doors block sight." },
  { id: "guard", label: "Guard", key: "g", icon: <GuardIcon />, hint: "Click floor to post a guard, then keep clicking to add patrol waypoints." },
  { id: "camera", label: "Camera", key: "c", icon: <Cctv size={16} />, hint: "Mount on a wall next to open floor. Set its sweep in the panel." },
  { id: "laser", label: "Laser", key: "t", icon: <Zap size={16} />, hint: "Click two tiles in a line to stretch a tripwire between them." },
  { id: "erase", label: "Erase", key: "e", icon: <Eraser size={16} />, hint: "Drag to remove anything on a tile." },
];

export const KEY_CSS: Record<KeyColor, string> = { red: "var(--red-key)", blue: "var(--blue-key)", gold: "var(--gold-key)" };

export function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const color = useEditor((s) => s.color);
  const setTool = useEditor((s) => s.setTool);
  const setColor = useEditor((s) => s.setColor);
  const showColors = tool === "key" || tool === "door";

  return (
    <div className="flex flex-col gap-2">
      <div role="toolbar" aria-label="Tools" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {TOOLS.map((t) => {
          const on = t.id === tool;
          return (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              aria-pressed={on}
              title={`${t.label} (${t.key.toUpperCase()}): ${t.hint}`}
              className={`press group flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-2 font-mono text-xs transition-colors ${
                on ? "border-cyan/70 bg-cyan/12 text-paper shadow-[0_0_14px_-4px_var(--cyan)]" : "border-transparent text-dim hover:border-line hover:text-paper"
              }`}
            >
              <span className={on ? "text-cyan" : ""}>{t.icon}</span>
              <span className="hidden lg:inline">{t.label}</span>
              <kbd className="ml-auto hidden rounded border border-line px-1 text-[0.6rem] text-faint lg:inline">{t.key.toUpperCase()}</kbd>
            </button>
          );
        })}
      </div>
      {showColors && (
        <div className="rise flex items-center gap-2 rounded-md border border-line bg-ink2/60 px-2.5 py-2" aria-label="Keycard color">
          {(["red", "blue", "gold"] as KeyColor[]).map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`${c} ${tool}`}
              aria-pressed={color === c}
              className={`press h-6 w-6 rounded-md border-2 transition-transform ${color === c ? "scale-110 border-paper" : "border-transparent opacity-60 hover:opacity-100"}`}
              style={{ background: KEY_CSS[c] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
