import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HEISTS, getHeist } from "@/content/heists";
import { HeistClient } from "./HeistClient";

export function generateStaticParams() {
  return HEISTS.map((h) => ({ id: h.id }));
}

export async function generateMetadata(props: PageProps<"/heists/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const h = getHeist(id);
  return { title: h ? `${h.n}. ${h.title}` : "Heist" };
}

export default async function HeistPage(props: PageProps<"/heists/[id]">) {
  const { id } = await props.params;
  const heist = getHeist(id);
  if (!heist) notFound();
  return <HeistClient heist={heist} />;
}
