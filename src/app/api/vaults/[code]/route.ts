import { requireUser } from "@/server/auth";
import { handler, json } from "@/server/http";
import { hideVault } from "@/server/vaults";

export const DELETE = handler(async (_req: Request, ctx: RouteContext<"/api/vaults/[code]">) => {
  const { code } = await ctx.params;
  const user = await requireUser();
  await hideVault(code, user);
  return json({ ok: true });
});
