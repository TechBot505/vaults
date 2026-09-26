import type { Metadata } from "next";
import { HeistList } from "./HeistList";

export const metadata: Metadata = { title: "Heists", description: "Twelve tutorial heists that teach every trick in the building." };

export default function HeistsPage() {
  return <HeistList />;
}
