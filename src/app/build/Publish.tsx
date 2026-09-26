"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import type { VaultDef } from "@/engine/types";
import { encodeVault } from "@/lib/share";

export function Modal({ onClose, children, label, wide = false }: { onClose: () => void; children: React.ReactNode; label: string; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`blueprint relative max-h-[92dvh] w-full overflow-y-auto rounded-xl border border-line bg-ink2 p-5 shadow-2xl ${wide ? "max-w-4xl" : "max-w-lg"}`}
      >
        <button onClick={onClose} className="press absolute right-3 top-3 text-faint hover:text-paper" aria-label="Close" autoFocus>
          <X size={18} />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

export function ShareLink({ def, title, par }: { def: VaultDef; title: string; par?: number }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/play?v=${encodeVault({ def, title, par })}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-line bg-ink px-3 py-2 font-mono text-xs text-dim" aria-label="Share link" />
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* clipboard blocked: the field is selectable */
            }
          }}
          className="press flex shrink-0 items-center gap-1.5 rounded-md bg-paper px-3 font-mono text-xs text-ink"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "copied" : "copy"}
        </button>
      </div>
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start font-mono text-xs text-cyan hover:underline">
        <ExternalLink size={12} /> open it like a player would
      </a>
    </div>
  );
}
