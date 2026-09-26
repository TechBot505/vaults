import type { Metadata } from "next";
import { getHeist } from "@/content/heists";
import { decodeVault } from "@/lib/share";
import type { VaultDef } from "@/engine/types";
import { getUser } from "@/server/auth";
import { getVaultDefForRemix } from "@/server/vaults";
import { databaseEnabled } from "@/server/env";
import { BuildClient } from "./BuildClient";

export const metadata: Metadata = {
  title: "Vault builder",
  description: "Draw a vault, set the guards, cameras and lasers, prove you can crack it, and dare the internet.",
};

export default async function BuildPage(props: PageProps<"/build">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const forkId = one(sp.fork);
  const shared = one(sp.v);
  const remix = one(sp.remix);
  const user = databaseEnabled ? await getUser() : null;
  let fork: { def: VaultDef; title: string } | null = null;
  if (forkId) {
    const h = getHeist(forkId);
    if (h) fork = { def: h.def, title: h.title };
  } else if (remix) {
    // published vaults can only be remixed by people who've cracked them (no peeking with the Machine)
    fork = await getVaultDefForRemix(remix, user);
  } else if (shared) {
    const v = decodeVault(shared);
    if (v) fork = { def: v.def, title: v.title };
  }
  return <BuildClient fork={fork} draft={one(sp.draft) ?? null} server={{ publicVaults: databaseEnabled, handle: user?.handle ?? null }} />;
}
