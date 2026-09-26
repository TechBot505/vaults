import { z } from "zod";
import { getUser } from "@/server/auth";
import { clientIp, handler, json, parseBody } from "@/server/http";
import { rateLimit, RATE } from "@/server/rate-limit";
import { recordAttempt, MAX_MOVES } from "@/server/vaults";

const body = z.object({
  moves: z.string().min(1).max(MAX_MOVES).regex(/^[UDLRWE]+$/),
  player: z.string().regex(/^[a-z0-9]{8,32}$/),
  ms: z.number().int().min(0).max(86_400_000),
});

export const POST = handler(async (req: Request, ctx: RouteContext<"/api/vaults/[code]/attempts">) => {
  const { code } = await ctx.params;
  rateLimit(`attempt:${clientIp(req)}`, RATE.attempt);
  const input = await parseBody(req, body, 16_000);
  const user = await getUser();
  return json(await recordAttempt(code, user, input));
});
