"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useClientAuth } from "@/lib/auth-client";

const NAV = [
  { href: "/heists", label: "heists" },
  { href: "/vaults", label: "vaults" },
  { href: "/build", label: "build" },
  { href: "/leaderboard", label: "leaderboard" },
];

export function Logo() {
  return (
    <Link href="/" className="press group flex items-center gap-2.5" aria-label="VAULTS home">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="transition-transform duration-700 group-hover:rotate-[120deg]">
        <circle cx="13" cy="13" r="11" fill="none" stroke="var(--cyan)" strokeWidth="2" />
        <circle cx="13" cy="13" r="4.5" fill="none" stroke="var(--cyan)" strokeWidth="1.6" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line key={a} x1="13" y1="3.5" x2="13" y2="6.5" stroke="var(--cyan)" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${a} 13 13)`} />
        ))}
        <circle cx="13" cy="13" r="1.4" fill="var(--gold)" />
      </svg>
      <span className="display text-[1.05rem] tracking-[0.12em] text-paper">VAULTS</span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const auth = useClientAuth();
  return (
    <div className="relative flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded focus:bg-ink2 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="relative z-30 mx-auto flex h-16 w-full max-w-[1300px] items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link key={n.href} href={n.href} className={`press relative shrink-0 px-3 py-1.5 font-mono text-[0.78rem] ${active ? "text-paper" : "text-dim hover:text-paper"}`} aria-current={active ? "page" : undefined}>
                {n.label}
                {active && <motion.span layoutId="nav" className="absolute inset-x-3 -bottom-0.5 h-[2px] bg-cyan" style={{ boxShadow: "0 0 10px var(--cyan)" }} />}
              </Link>
            );
          })}
        </nav>
        {auth.enabled &&
          (auth.signedIn ? (
            <Link href="/me" className="press h-8 w-8 overflow-hidden rounded-full border border-line" aria-label="Your profile">
              {auth.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={auth.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-xs">you</span>
              )}
            </Link>
          ) : (
            <button onClick={auth.openSignIn} className="press rounded-md border border-line px-3 py-1.5 font-mono text-xs text-paper hover:border-cyan">
              sign in
            </button>
          ))}
      </header>
      <main id="main" className="relative flex flex-1 flex-col">
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-[1300px] flex-wrap items-center justify-between gap-3 px-4 py-6 font-mono text-[0.68rem] text-faint sm:px-6">
        <span>VAULTS · every vault here has been cracked at least once, by its builder.</span>
        <span className="flex gap-4">
          <Link href="/how" className="hover:text-dim">how it works</Link>
          <Link href="/settings" className="hover:text-dim">settings</Link>
        </span>
      </footer>
    </div>
  );
}
