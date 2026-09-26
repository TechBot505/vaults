import type { Metadata } from "next";
import Link from "next/link";
import { decodeVault } from "@/lib/share";
import { PlayClient } from "./PlayClient";

export async function generateMetadata(props: PageProps<"/play">): Promise<Metadata> {
  const sp = await props.searchParams;
  const v = typeof sp.v === "string" ? decodeVault(sp.v) : null;
  if (!v) return { title: "Vault not found" };
  return { title: v.title, description: `Someone built a vault and dared you to crack it${v.par ? ` (par ${v.par} turns)` : ""}.` };
}

export default async function PlayPage(props: PageProps<"/play">) {
  const sp = await props.searchParams;
  const code = typeof sp.v === "string" ? sp.v : null;
  const v = code ? decodeVault(code) : null;
  if (!v || !code) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-4 text-center">
        <div>
          <div className="label text-alarm">bad blueprint</div>
          <h1 className="display mt-3 text-3xl text-paper">This vault link is broken.</h1>
          <p className="mt-3 text-dim">It may have been cut off when it was copied. Ask for the link again, or try one of ours.</p>
          <Link href="/heists" className="press mt-6 inline-flex rounded-md bg-paper px-4 py-2 font-mono text-sm text-ink">
            play the heists
          </Link>
        </div>
      </div>
    );
  }
  return <PlayClient def={v.def} title={v.title} par={v.par ?? null} code={code} />;
}
