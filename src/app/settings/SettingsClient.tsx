"use client";

import { useState } from "react";
import { useSettings } from "@/stores/settings";
import { useHydrated } from "@/lib/hooks";
import { primeAudio, sfx } from "@/lib/sound";
import { HEISTS } from "@/content/heists";

function Row({ title, body, children }: { title: string; body?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-4 first:border-t-0">
      <div>
        <div className="text-paper">{title}</div>
        {body && <div className="text-sm text-faint">{body}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full border transition-colors ${on ? "border-cyan bg-cyan/30" : "border-line bg-ink"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${on ? "left-[1.4rem] bg-cyan shadow-[0_0_10px_var(--cyan)]" : "left-0.5 bg-faint"}`} />
    </button>
  );
}

export function SettingsClient() {
  const s = useSettings();
  const hydrated = useHydrated();
  const [confirm, setConfirm] = useState(false);
  if (!hydrated) return <div className="min-h-[60vh]" />;
  const done = Object.keys(s.campaign).length;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="label text-cyan">settings</div>
      <h1 className="display mt-3 text-4xl text-paper">Settings.</h1>
      <p className="mt-2 text-sm text-faint">Saved on this device.</p>

      <div className="mt-8 rounded-xl border border-line bg-ink2/60 px-5">
        <Row title="Sound" body="Footsteps, alarms, the click of a lock.">
          <Toggle
            label="Sound"
            on={s.sound}
            onChange={(v) => {
              s.set({ sound: v });
              if (v) {
                primeAudio();
                setTimeout(() => sfx("loot"), 30);
              }
            }}
          />
        </Row>
        <Row title="Volume">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            disabled={!s.sound}
            onChange={(e) => s.set({ volume: Number(e.target.value) })}
            onPointerUp={() => sfx("click")}
            className="w-36 accent-[var(--cyan)] disabled:opacity-40"
            aria-label="Volume"
          />
        </Row>
        <Row title="Effects" body="Screen shake and alarm flashes when you get caught.">
          <Toggle label="Effects" on={s.effects} onChange={(v) => s.set({ effects: v })} />
        </Row>
        <Row title="Fast animations" body="Snappier turns for speedrunners.">
          <Toggle label="Fast animations" on={s.speed === "fast"} onChange={(v) => s.set({ speed: v ? "fast" : "normal" })} />
        </Row>
        <Row title="Forecast by default" body="Always show where everyone will look next turn (F toggles it in a heist).">
          <Toggle label="Forecast" on={s.forecast} onChange={(v) => s.set({ forecast: v })} />
        </Row>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-ink2/60 px-5">
        <Row title="Campaign progress" body={`${done} of ${HEISTS.length} heists cracked on this device.`}>
          <button
            disabled={done === 0}
            onClick={() => {
              if (!confirm) return setConfirm(true);
              s.set({ campaign: {} });
              setConfirm(false);
            }}
            className="press rounded-md border border-alarm/40 px-3 py-1.5 font-mono text-xs text-alarm hover:bg-alarm/10 disabled:opacity-30"
          >
            {confirm ? "really reset?" : "reset"}
          </button>
        </Row>
      </div>
    </div>
  );
}
