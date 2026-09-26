import { z } from "zod";
import { requireUser } from "@/server/auth";
import { handler, json, parseBody } from "@/server/http";
import { rateLimit, RATE } from "@/server/rate-limit";
import { publishVault, MAX_MOVES } from "@/server/vaults";

// the Machine runs on publish to set par and the security rating
export const maxDuration = 60;

const body = z.object({
  title: z.string().max(80),
  def: z.unknown(),
  proof: z.string().min(1).max(MAX_MOVES).regex(/^[UDLRWE]+$/),
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  rateLimit(`publish:${user.id}`, RATE.publish);
  const input = await parseBody(req, body, 64_000);
  const { code } = await publishVault(user, input);
  return json({ code }, { status: 201 });
});
