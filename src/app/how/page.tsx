import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works", description: "The exact rules of every heist, in the order they happen." };

const ORDER = [
  ["Act", "Move one tile (arrows / WASD / swipe), wait a turn (space), or fire an EMP (E). Walls and locked doors refuse the move and no time passes."],
  ["Takedown", "Step onto a guard to knock them out. They leave a body. Armored guards (the hexagon ones) can't be knocked out: walking into one gets you caught."],
  ["Pick up", "Loot and keycards on your tile go in your bag. A keycard opens every door of its colour."],
  ["Escape", "Holding all the loot while standing on the entrance cracks the vault."],
  ["Tick", "The building takes its next beat: guards step along their patrol, cameras turn, lasers switch. A guard walking onto you catches you."],
  ["Detect", "If any guard or camera can see your tile, or you stand in a live laser, you're caught. If anyone can see a body, the alarm goes off and you're caught too."],
  ["Clock", "Some vaults have a turn limit. Run out and the police arrive."],
];

export default function HowPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="label text-cyan">rules</div>
      <h1 className="display mt-3 text-4xl text-paper sm:text-5xl">How a heist works.</h1>
      <p className="mt-5 text-dim">
        VAULTS is turn-based and completely deterministic. Nothing is random: the same moves in the same vault always end the same way, on every device. The server replays every run through
        the same engine to check it.
      </p>

      <h2 className="label mt-10 text-gold">each turn, in this order</h2>
      <ol className="mt-4 flex flex-col gap-3">
        {ORDER.map(([t, b], i) => (
          <li key={t} className="flex gap-4 rounded-lg border border-line bg-ink2/60 p-4">
            <span className="font-mono text-sm text-cyan">{i + 1}</span>
            <div>
              <h3 className="font-display text-paper">{t}</h3>
              <p className="mt-1 text-sm text-dim">{b}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="label mt-10 text-gold">sight</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-dim">
        <p>Guards and cameras see in a cone: the tile straight ahead, then one tile wider on each side every two tiles. Range is shown when you hover them. Guards see the way they walk.</p>
        <p>Walls, doors and the outside block sight. So does the crack where two wall corners touch diagonally: you can never be seen through it.</p>
        <p>Red tiles are watched by guards, amber by cameras. Press F to forecast: dashed outlines show what will be watched after your next move.</p>
      </div>

      <h2 className="label mt-10 text-gold">tools</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-dim">
        <p>
          <span className="text-emp">EMP</span>: cameras and lasers go dark for three turns. Guards don&apos;t care.
        </p>
        <p>
          <span className="text-alarm">Takedowns</span> work from any side, as long as the guard can&apos;t see you coming. Bodies stay where they fall.
        </p>
      </div>

      <h2 className="label mt-10 text-gold">fair play</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-dim">
        <p>Every public vault was cracked by its builder before it was published, so there is always a way in.</p>
        <p>
          <span className="text-cyan">The Machine</span> is a search that tries every possible heist, shortest first. It sets each vault&apos;s par and its security rating (one to five locks). If it gives up, the vault is marked, and the builder&apos;s own crack becomes par.
        </p>
        <p>Best runs and the capture map of a vault unlock once you&apos;ve cracked it yourself. Remixing a published vault also needs a crack first.</p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/heists" className="press rounded-md bg-gold px-5 py-2.5 font-mono text-sm text-ink">
          play the campaign
        </Link>
        <Link href="/build" className="press rounded-md border border-line px-5 py-2.5 font-mono text-sm text-paper">
          build a vault
        </Link>
      </div>
    </div>
  );
}
