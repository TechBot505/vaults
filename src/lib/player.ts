"use client";

/** Anonymous per-device id: counts unique players without an account. */
export function playerId(): string {
  const make = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join("");
  try {
    let id = localStorage.getItem("vaults:player");
    if (!id || !/^[a-z0-9]{8,32}$/.test(id)) {
      id = make();
      localStorage.setItem("vaults:player", id);
    }
    return id;
  } catch {
    return make();
  }
}

export async function shareOrCopy(data: { title: string; text: string; url: string }): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches) {
      await navigator.share(data);
      return "shared";
    }
    await navigator.clipboard.writeText(`${data.text} ${data.url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
