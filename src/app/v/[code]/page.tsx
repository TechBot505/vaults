import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUser } from "@/server/auth";
import { getVault, vaultAccess, vaultLeaderboard } from "@/server/vaults";
import { VaultClient } from "./VaultClient";

export async function generateMetadata(props: PageProps<"/v/[code]">): Promise<Metadata> {
  const { code } = await props.params;
  const v = await getVault(code);
  if (!v) return { title: "Vault not found" };
  const rate = v.attempts ? `${v.cracks} of ${v.attempts} runs cracked it` : "Nobody has tried it yet";
  return {
    title: v.title,
    description: `A vault by @${v.creator.handle}. ${rate}. Can you get the loot out?`,
    openGraph: { title: `${v.title} · VAULTS`, description: `${rate}. Can you?` },
  };
}

export default async function VaultPage(props: PageProps<"/v/[code]">) {
  const { code } = await props.params;
  const vault = await getVault(code);
  if (!vault) notFound();
  const user = await getUser();
  const [board, access] = await Promise.all([vaultLeaderboard(code), vaultAccess(code, user)]);
  return <VaultClient vault={vault} board={board} viewer={user ? { handle: user.handle } : null} access={access} />;
}
