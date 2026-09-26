import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/**
 * Clerk session handling when auth is configured; a no-op otherwise, so the
 * game runs fully anonymous without any keys.
 */
const clerkOn = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
const clerk = clerkOn ? clerkMiddleware() : null;

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (clerk) return clerk(req, event);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // everything except Next internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Clerk's frontend API auto-proxy
    "/__clerk/:path*",
  ],
};
