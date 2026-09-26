"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, FilePlus2, FolderOpen, Redo2, Send, Trash2, Undo2 } from "lucide-react";
import { Level } from "@/engine/geometry";
import { validateVault, type Problem } from "@/engine/validate";
import type { VaultDef } from "@/engine/types";
import { HeistPlayer } from "@/components/board/HeistPlayer";
import { ReplayView } from "@/components/board/ReplayView";
import { toast } from "@/components/Toaster";
import { blankDoc, fromVault, hashVault, removeGuard, toVault, type EditorDoc } from "@/editor/doc";
import { deleteDraft, listDrafts, loadDraft, newDraftId, saveDraft, useEditor, type DraftMeta } from "@/editor/store";
import { useMachine } from "@/lib/machine";
import { sfx } from "@/lib/sound";
import { Canvas } from "./Canvas";
import { Checks } from "./Checks";
import { Inspector } from "./Inspector";
import { Modal, ShareLink } from "./Publish";
import { TOOLS, Toolbar } from "./tools";

/** A starter vault: small, clearly crackable, and teaches the tools by example. */
function starterDoc(): EditorDoc {
  const d = blankDoc(13, 9);
  return { ...d, title: "Untitled vault" };
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function BuildClient({ fork, draft }: { fork: { def: VaultDef; title: string } | null; draft: string | null }) {
  const draftId = useEditor((s) => s.draftId);
  const doc = useEditor((s) => s.doc);
  const proof = useEditor((s) => s.proof);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const tool = useEditor((s) => s.tool);
  const selection = useEditor((s) => s.selection);
  const [mode, setMode] = useState<"edit" | "test">("edit");
  const [watch, setWatch] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [drafts, setDrafts] = useState<DraftMeta[] | null>(null);
  const booted = useRef(false);
  const lastTitleEdit = useRef(0);
  const machine = useMachine();
  const lastRun = useRef<VaultDef | null>(null);

  // ── load: fork → draft in the URL → most recent draft → a fresh blueprint ──
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const st = useEditor.getState();
    let id: string;
    if (fork) {
      id = newDraftId();
      const d = fromVault(fork.def, `${fork.title} (remix)`.slice(0, 60));
      st.load(id, d);
      saveDraft(id, d, null);
    } else {
      const want = draft ?? listDrafts()[0]?.id;
      const saved = want ? loadDraft(want) : null;
      if (want && saved) {
        id = want;
        st.load(id, saved.doc, saved.proof);
      } else {
        id = newDraftId();
        st.load(id, starterDoc());
      }
    }
    window.history.replaceState(null, "", `/build?draft=${id}`);
  }, [fork, draft]);

  // ── autosave ──
  useEffect(() => {
    if (!draftId) return;
    const t = setTimeout(() => saveDraft(draftId, doc, proof), 350);
    return () => clearTimeout(t);
  }, [draftId, doc, proof]);

  const { def, routeErrors } = useMemo(() => toVault(doc), [doc]);
  const level = useMemo(() => new Level(def), [def]);
  const problems: Problem[] = useMemo(() => {
    const r = validateVault(def);
    return [...routeErrors.map((e) => ({ code: "route", message: e.message })), ...(r.ok ? [] : r.problems)];
  }, [def, routeErrors]);
  const valid = problems.length === 0;
  const hash = useMemo(() => hashVault(def), [def]);
  const proofTurns = proof && proof.hash === hash ? proof.moves.length : null;
  const canPublish = valid && proofTurns != null;

  // ── the Machine re-cases the vault whenever it changes ──
  const { run } = machine;
  useEffect(() => {
    if (!draftId || !valid || lastRun.current === def) return;
    const t = setTimeout(() => {
      lastRun.current = def;
      run(def, 400_000);
    }, 450);
    return () => clearTimeout(t);
  }, [draftId, def, valid, run]);

  // ── keyboard ──
  useEffect(() => {
    if (mode !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const st = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === "Escape") {
        if (st.laserStart) st.setLaserStart(null);
        else st.select(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && st.selection) {
        e.preventDefault();
        const s = st.selection;
        const d = st.doc;
        if (s.kind === "guard") st.commit(removeGuard(d, s.id));
        if (s.kind === "camera") st.commit({ ...d, cameras: d.cameras.filter((c) => c.id !== s.id) });
        if (s.kind === "laser") st.commit({ ...d, lasers: d.lasers.filter((l) => l.id !== s.id) });
        st.select(null);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        window.dispatchEvent(new Event("vaults:toggle-timeline"));
        return;
      }
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (t) st.setTool(t.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const newVault = () => {
    const id = newDraftId();
    useEditor.getState().load(id, starterDoc());
    window.history.replaceState(null, "", `/build?draft=${id}`);
    setDrafts(null);
  };
  const openDraft = (id: string) => {
    const saved = loadDraft(id);
    if (!saved) return;
    useEditor.getState().load(id, saved.doc, saved.proof);
    window.history.replaceState(null, "", `/build?draft=${id}`);
    setDrafts(null);
  };

  if (!draftId) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <span className="label animate-pulse text-cyan">unrolling blueprints…</span>
      </div>
    );
  }

  if (mode === "test") {
    return (
      <div className="flex flex-col">
        <div className="mx-auto w-full max-w-[1200px] px-4 pt-3 sm:px-6">
          <button onClick={() => setMode("edit")} className="press inline-flex items-center gap-1.5 font-mono text-xs text-dim hover:text-paper">
            <ArrowLeft size={14} /> back to the drawing board
          </button>
        </div>
        <HeistPlayer
          key={hash}
          def={def}
          title={doc.title}
          kicker="test crack · your vault"
          par={machine.state.status === "done" && machine.state.def === def && machine.state.result.status === "solved" ? machine.state.result.turns : null}
          onEnd={(s) => {
            if (s.status !== "cracked") return;
            useEditor.getState().setProof({ hash, moves: s.moves });
            toast({ title: "Proof recorded", body: `You cracked your own vault in ${s.t} turns. It's ready to publish.`, tone: "good" });
          }}
          crackedActions={() => (
            <>
              <button autoFocus onClick={() => { setMode("edit"); setPublishing(true); }} className="press inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 font-mono text-sm text-ink hover:brightness-110">
                <Send size={15} /> publish it
              </button>
              <button onClick={() => setMode("edit")} className="press inline-flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-mono text-sm text-dim hover:text-paper">
                keep building
              </button>
            </>
          )}
          caughtActions={() => (
            <button onClick={() => setMode("edit")} className="press inline-flex items-center gap-2 rounded-md border border-line px-4 py-2.5 font-mono text-sm text-dim hover:text-paper">
              <ArrowLeft size={15} /> back to the drawing board
            </button>
          )}
        />
      </div>
    );
  }

  const toolInfo = TOOLS.find((t) => t.id === tool)!;
  const bestTurns = machine.state.status === "done" && machine.state.def === def && machine.state.result.status === "solved" ? machine.state.result.turns : undefined;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 pb-8 sm:px-5">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2 py-3">
        <input
          value={doc.title}
          maxLength={60}
          onChange={(e) => {
            const now = Date.now();
            const st = useEditor.getState();
            st.commit({ ...st.doc, title: e.target.value }, now - lastTitleEdit.current < 1500);
            lastTitleEdit.current = now;
          }}
          onBlur={(e) => {
            if (!e.target.value.trim()) useEditor.getState().commit({ ...useEditor.getState().doc, title: "Untitled vault" }, true);
          }}
          className="font-display min-w-0 flex-1 basis-56 rounded-md border border-transparent bg-transparent px-2 py-1 text-xl text-paper outline-none transition-colors hover:border-line focus:border-cyan/60 sm:text-2xl"
          aria-label="Vault name"
        />
        <div className="relative">
          <button
            onClick={() => setDrafts((d) => (d ? null : listDrafts()))}
            className="press inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 font-mono text-xs text-dim hover:text-paper"
            aria-expanded={!!drafts}
          >
            <FolderOpen size={14} /> drafts <ChevronDown size={12} />
          </button>
          {drafts && (
            <div className="rise absolute right-0 z-40 mt-1 w-72 rounded-lg border border-line bg-ink2 p-1.5 shadow-2xl">
              <button onClick={newVault} className="press flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-paper hover:bg-ink3">
                <FilePlus2 size={14} className="text-mint" /> new blank vault
              </button>
              <Link href="/heists" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-dim hover:bg-ink3 hover:text-paper">
                <FolderOpen size={14} /> remix a campaign heist…
              </Link>
              <div className="my-1 h-px bg-line" />
              <ul className="max-h-72 overflow-y-auto">
                {drafts.map((d) => (
                  <li key={d.id} className={`group flex items-center gap-1 rounded-md ${d.id === draftId ? "bg-cyan/10" : "hover:bg-ink3"}`}>
                    <button onClick={() => openDraft(d.id)} className="min-w-0 flex-1 px-2.5 py-1.5 text-left">
                      <div className="truncate text-sm text-paper">{d.title || "Untitled vault"}</div>
                      <div className="font-mono text-[0.65rem] text-faint">{new Date(d.updated).toLocaleString()}</div>
                    </button>
                    {d.id !== draftId && (
                      <button
                        onClick={() => {
                          deleteDraft(d.id);
                          setDrafts(listDrafts());
                        }}
                        className="press mr-1 p-1.5 text-faint opacity-0 hover:text-alarm group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Delete ${d.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                ))}
                {drafts.length === 0 && <li className="px-2.5 py-2 text-xs text-faint">No saved drafts yet.</li>}
              </ul>
            </div>
          )}
        </div>
        <div className="flex overflow-hidden rounded-md border border-line">
          <button onClick={() => useEditor.getState().undo()} disabled={!canUndo} className="press p-2 text-dim hover:text-paper disabled:opacity-30" aria-label="Undo" title="Undo (Ctrl+Z)">
            <Undo2 size={15} />
          </button>
          <button onClick={() => useEditor.getState().redo()} disabled={!canRedo} className="press border-l border-line p-2 text-dim hover:text-paper disabled:opacity-30" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={15} />
          </button>
        </div>
        <button
          onClick={() => {
            if (!canPublish) {
              toast({ title: valid ? "Crack it first" : "Fix the blueprint first", body: valid ? "Test-crack your own vault. Nobody gets to publish a vault they can't beat." : problems[0]?.message, tone: "bad" });
              sfx("blocked");
              return;
            }
            setPublishing(true);
          }}
          className={`press inline-flex items-center gap-2 rounded-md px-4 py-1.5 font-mono text-sm transition ${canPublish ? "bg-gold text-ink shadow-[0_0_24px_-6px_var(--gold)] hover:brightness-110" : "border border-line text-faint"}`}
        >
          <Send size={14} /> publish
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[176px_minmax(0,1fr)_330px]">
        <div className="flex flex-col gap-3 lg:sticky lg:top-3 lg:self-start">
          <Toolbar />
          <p className="hidden text-xs leading-relaxed text-faint lg:block">{toolInfo.hint}</p>
          {tool === "guard" && selection?.kind === "guard" && (
            <p className="hidden rounded-md border border-cyan/30 bg-cyan/5 px-2.5 py-2 text-xs text-cyan lg:block">
              Adding waypoints to {selection.id}. Press Esc to finish and post another guard.
            </p>
          )}
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-xs text-faint lg:hidden">{toolInfo.hint}</p>
          <Canvas level={level} problems={problems} />
        </div>
        <aside className="flex flex-col gap-3">
          <Inspector />
          <Checks
            def={def}
            problems={problems}
            proofTurns={proofTurns}
            machine={machine.state}
            onTest={() => {
              useEditor.getState().select(null);
              setMode("test");
            }}
            onThinkHarder={() => machine.run(def, 2_000_000)}
            onWatch={setWatch}
          />
        </aside>
      </div>

      {watch && (
        <Modal onClose={() => setWatch(null)} label="The Machine's route" wide>
          <div className="label mb-1 text-cyan">the machine</div>
          <h2 className="font-display mb-4 text-2xl text-paper">The shortest way in</h2>
          <ReplayView def={def} moves={watch} label="The Machine's route" height="60vh" />
        </Modal>
      )}

      {publishing && canPublish && (
        <Modal onClose={() => setPublishing(false)} label="Publish">
          <div className="label mb-1 text-gold">ready</div>
          <h2 className="font-display text-2xl text-paper">{doc.title}</h2>
          <p className="mt-2 text-sm text-dim">Send this link to anyone. They get your vault exactly as you built it{bestTurns ? `, with the Machine's ${bestTurns}-turn best as par` : ""}.</p>
          <div className="mt-4">
            <ShareLink def={def} title={doc.title} par={bestTurns ?? proofTurns ?? undefined} />
          </div>
        </Modal>
      )}
    </div>
  );
}
