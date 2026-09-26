"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClientAuth } from "@/lib/auth-client";

export function SignInPrompt() {
  const auth = useClientAuth();
  const router = useRouter();
  // after signing in through the modal, the server can now resolve the profile
  useEffect(() => {
    if (auth.signedIn) router.refresh();
  }, [auth.signedIn, router]);
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 text-center">
      <div>
        <div className="label text-cyan">your file</div>
        <h1 className="display mt-3 text-3xl text-paper">Who are you?</h1>
        <p className="mt-3 text-dim">{auth.enabled ? "Sign in to put your name on the cracks and the vaults you build." : "Accounts aren't switched on for this site. Everything still works anonymously."}</p>
        {auth.enabled && (
          <button onClick={auth.openSignIn} className="press mt-6 rounded-md bg-paper px-5 py-2.5 font-mono text-sm text-ink">
            sign in
          </button>
        )}
      </div>
    </div>
  );
}
