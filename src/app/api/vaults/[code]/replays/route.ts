import { getUser } from "@/server/auth";
import { HttpError, handler, json } from "@/server/http";
import { deathMap, replays, vaultAccess } from "@/server/vaults";

/** Solutions are spoilers: only the builder and people who've cracked it get them. */
export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/vaults/[code]/replays">) => {
  const { code } = await ctx.params;
  const user = await getUser();
  if (!user) throw new HttpError(401, "sign in and crack it to unlock replays");
  const access = await vaultAccess(code, user);
  if (!access.cracked) throw new HttpError(403, "crack it first");
  const [runs, deaths] = await Promise.all([replays(code), deathMap(code)]);
  return json({ runs, deaths });
});
