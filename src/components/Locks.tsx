import { Lock } from "lucide-react";

/** Security rating: 1–5 locks. */
export function Locks({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} of 5 locks`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Lock key={i} size={size} className={i <= n ? "text-gold drop-shadow-[0_0_4px_var(--gold)]" : "text-faint"} />
      ))}
    </span>
  );
}
