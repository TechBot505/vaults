"use client";

import { create } from "zustand";
import { AnimatePresence, motion } from "motion/react";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone?: "default" | "good" | "bad";
}

let nextId = 1;

export const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void }>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...t, id }].slice(-3) });
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export const toast = (t: Omit<Toast, "id">) => useToasts.getState().push(t);

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[95] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-auto rounded-lg border bg-ink2/95 px-4 py-3 text-left shadow-2xl backdrop-blur"
            style={{ borderColor: t.tone === "good" ? "var(--mint)" : t.tone === "bad" ? "var(--alarm)" : "var(--line)" }}
          >
            <div className="text-sm font-medium text-paper">{t.title}</div>
            {t.body && <div className="mt-0.5 font-mono text-xs text-dim">{t.body}</div>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
