import { getVault } from "@/server/vaults";
import { OG_SIZE, vaultCard } from "@/server/og";
import { getHeist } from "@/content/heists";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A vault on VAULTS";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const v = await getVault(code);
  if (!v) {
    const h = getHeist("gauntlet")!;
    return vaultCard({ def: h.def, kicker: "VAULTS", title: "Vault not found", stat: "Build one nobody can crack." });
  }
  const caught = v.attempts - v.cracks;
  const stat = v.attempts === 0 ? "Untouched. Be the first." : v.cracks === 0 ? `NEVER CRACKED · ${caught} caught` : `${v.cracks} of ${v.attempts} runs cracked it`;
  return vaultCard({ def: v.def, kicker: `VAULT ${v.code.toUpperCase()}`, title: v.title, byline: `built by @${v.creator.handle}`, stat, statTone: v.cracks === 0 && v.attempts > 0 ? "alarm" : "paper", locks: v.rating });
}
