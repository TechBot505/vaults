"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Globe, Loader2, X } from "lucide-react";
import { useClientAuth } from "@/lib/auth-client";
import { sfx } from "@/lib/sound";
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
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/play?v=${encodeVault({ def, title, par })}`;
  return (
    <div className="flex flex-col gap-2">
      <CopyField value={url} label="Share link" />
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start font-mono text-xs text-cyan hover:underline">
        <ExternalLink size={12} /> open it like a player would
      </a>
    </div>
  );
}

type PublishState = { status: "idle" } | { status: "sending" } | { status: "done"; code: string } | { status: "error"; message: string; signIn?: boolean };

/** Publish to the public list (server re-verifies the proof and runs the Machine). */
export function PublishPublic({ def, title, proof }: { def: VaultDef; title: string; proof: string }) {
  const [state, setState] = useState<PublishState>({ status: "idle" });
  const auth = useClientAuth();
  const publish = async () => {
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/vaults", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, def, proof }) });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return setState({ status: "error", message: "Sign in to put your name on it.", signIn: true });
      if (!res.ok) return setState({ status: "error", message: body?.error ?? "Publishing failed. Try again." });
      setState({ status: "done", code: body.code });
      sfx("cracked");
    } catch {
      setState({ status: "error", message: "Network error. Try again." });
    }
  };

  if (state.status === "done") {
    const url = `${window.location.origin}/v/${state.code}`;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-mint">It&apos;s live. Every capture counts toward your score as a builder.</p>
        <CopyField value={url} label="Vault link" />
        <Link href={`/v/${state.code}`} className="press inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 font-mono text-sm text-ink hover:brightness-110">
          open your vault <ExternalLink size={14} />
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={publish}
        disabled={state.status === "sending"}
        className="press inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 font-mono text-sm text-ink shadow-[0_0_24px_-6px_var(--gold)] hover:brightness-110 disabled:opacity-60"
      >
        {state.status === "sending" ? (
          <>
            <Loader2 size={15} className="animate-spin" /> the Machine is rating it…
          </>
        ) : (
          <>
            <Globe size={15} /> publish to the vault list
          </>
        )}
      </button>
      {state.status === "error" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-alarm">
          {state.message}
          {state.signIn && auth.enabled && (
            <button onClick={auth.openSignIn} className="press rounded-md border border-cyan/60 px-3 py-1 font-mono text-xs text-cyan">
              sign in
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-line bg-ink px-3 py-2 font-mono text-xs text-dim" aria-label={label} />
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* the field is selectable */
          }
        }}
        className="press flex shrink-0 items-center gap-1.5 rounded-md bg-paper px-3 font-mono text-xs text-ink"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
