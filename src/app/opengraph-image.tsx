import { getHeist } from "@/content/heists";
import { OG_SIZE, vaultCard } from "@/server/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "VAULTS: build a vault nobody can crack";

export default function Image() {
  const h = getHeist("gauntlet")!;
  return vaultCard({ def: h.def, kicker: "A TURN-BASED HEIST GAME", title: "Build a vault nobody can crack.", stat: "Crack theirs. Build yours. Dare the internet.", statTone: "gold" });
}
