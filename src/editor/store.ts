"use client";

import { create } from "zustand";
import { blankDoc, type EditorDoc } from "./doc";

/**
 * Editor state with undo/redo. Drafts autosave to localStorage so nothing is
 * ever lost on refresh.
 */

export type Tool =
  | "select"
  | "wall"
  | "floor"
  | "void"
  | "entry"
  | "loot"
  | "key"
  | "door"
  | "guard"
  | "camera"
  | "laser"
  | "erase";

export type Selection = { kind: "guard" | "camera" | "laser"; id: string } | null;

export interface Proof {
  hash: string;
  moves: string;
}

interface EditorState {
  draftId: string;
  doc: EditorDoc;
  past: EditorDoc[];
  future: EditorDoc[];
  tool: Tool;
  color: "red" | "blue" | "gold";
  selection: Selection;
  /** laser tool: first click */
  laserStart: { x: number; y: number } | null;
  /** proof that the builder cracked this exact version */
  proof: Proof | null;
  /** timeline preview turn */
  t: number;
  load: (id: string, doc: EditorDoc, proof?: Proof | null) => void;
  /** apply a change; `merge` coalesces continuous strokes into one undo step */
  commit: (doc: EditorDoc, merge?: boolean) => void;
  undo: () => void;
  redo: () => void;
  setTool: (t: Tool) => void;
  setColor: (c: "red" | "blue" | "gold") => void;
  select: (s: Selection) => void;
  setLaserStart: (p: { x: number; y: number } | null) => void;
  setProof: (p: Proof | null) => void;
  setT: (t: number) => void;
}

const DRAFTS_KEY = "vaults:drafts";

export interface DraftMeta {
  id: string;
  title: string;
  updated: number;
}

export function listDrafts(): DraftMeta[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as DraftMeta[]) : [];
  } catch {
    return [];
  }
}

export function loadDraft(id: string): { doc: EditorDoc; proof: Proof | null } | null {
  try {
    const raw = localStorage.getItem(`vaults:draft:${id}`);
    return raw ? (JSON.parse(raw) as { doc: EditorDoc; proof: Proof | null }) : null;
  } catch {
    return null;
  }
}

export function saveDraft(id: string, doc: EditorDoc, proof: Proof | null) {
  try {
    localStorage.setItem(`vaults:draft:${id}`, JSON.stringify({ doc, proof }));
    const list = listDrafts().filter((d) => d.id !== id);
    list.unshift({ id, title: doc.title, updated: Date.now() });
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* storage full: drafts are best-effort */
  }
}

export function deleteDraft(id: string) {
  try {
    localStorage.removeItem(`vaults:draft:${id}`);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(listDrafts().filter((d) => d.id !== id)));
  } catch {
    /* ignore */
  }
}

export function newDraftId() {
  return Math.random().toString(36).slice(2, 10);
}

let lastMerge = 0;

export const useEditor = create<EditorState>((set, get) => ({
  draftId: "",
  doc: blankDoc(),
  past: [],
  future: [],
  tool: "wall",
  color: "red",
  selection: null,
  laserStart: null,
  proof: null,
  t: 0,
  load: (id, doc, proof = null) => set({ draftId: id, doc, past: [], future: [], selection: null, laserStart: null, proof, t: 0 }),
  commit: (doc, merge = false) => {
    const { doc: prev, past } = get();
    if (doc === prev) return;
    const now = Date.now();
    const coalesce = merge && now - lastMerge < 800 && past.length > 0;
    lastMerge = merge ? now : 0;
    set({ doc, past: coalesce ? past : [...past.slice(-99), prev], future: [] });
  },
  undo: () => {
    const { past, doc, future } = get();
    if (!past.length) return;
    set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future].slice(0, 100), selection: null });
  },
  redo: () => {
    const { past, doc, future } = get();
    if (!future.length) return;
    set({ doc: future[0], future: future.slice(1), past: [...past, doc], selection: null });
  },
  setTool: (tool) => set({ tool, laserStart: null }),
  setColor: (color) => set({ color }),
  select: (selection) => set({ selection }),
  setLaserStart: (laserStart) => set({ laserStart }),
  setProof: (proof) => set({ proof }),
  setT: (t) => set({ t }),
}));
