"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Settings {
  sound: boolean;
  volume: number;
  /** screen shake, flashes and grain */
  effects: boolean;
  /** animation speed of each turn */
  speed: "normal" | "fast";
  /** show where everything will be next turn */
  forecast: boolean;
  /** tutorial heists cracked (by id) with best turns */
  campaign: Record<string, { turns: number; at: number }>;
}

interface Store extends Settings {
  set: (p: Partial<Settings>) => void;
  completeHeist: (id: string, turns: number) => void;
}

export const DEFAULTS: Settings = {
  sound: true,
  volume: 0.6,
  effects: true,
  speed: "normal",
  forecast: false,
  campaign: {},
};

export const useSettings = create<Store>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      set: (p) => set(p),
      completeHeist: (id, turns) => {
        const prev = get().campaign[id];
        if (prev && prev.turns <= turns) return;
        set({ campaign: { ...get().campaign, [id]: { turns, at: Date.now() } } });
      },
    }),
    {
      name: "vaults:settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { set: _a, completeHeist: _b, ...rest } = s;
        return rest;
      },
    },
  ),
);
