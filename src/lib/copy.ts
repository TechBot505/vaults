import type { CaughtBy, VaultDef } from "@/engine/types";

export function caughtHeadline(by: CaughtBy | undefined): { title: string; body: string } {
  if (!by) return { title: "Busted", body: "" };
  switch (by.kind) {
    case "guard":
      return { title: "Spotted", body: "A guard saw you." };
    case "armored":
      return { title: "Bounced", body: "Armored guards can't be taken down." };
    case "camera":
      return { title: "On camera", body: "A security camera caught you." };
    case "laser":
      return { title: "Tripped", body: "You walked into a live laser." };
    case "body":
      return { title: "Body found", body: "Someone saw a guard you knocked out." };
    case "timeout":
      return { title: "Too slow", body: "The police arrived before you got out." };
  }
}

export function describeVault(def: VaultDef): string {
  const parts: string[] = [];
  if (def.guards.length) parts.push(`${def.guards.length} guard${def.guards.length > 1 ? "s" : ""}`);
  if (def.cameras.length) parts.push(`${def.cameras.length} camera${def.cameras.length > 1 ? "s" : ""}`);
  if (def.lasers.length) parts.push(`${def.lasers.length} laser${def.lasers.length > 1 ? "s" : ""}`);
  if (def.doors.length) parts.push(`${def.doors.length} door${def.doors.length > 1 ? "s" : ""}`);
  return parts.join(" · ") || "empty";
}
