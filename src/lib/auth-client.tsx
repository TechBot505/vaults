"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";

/**
 * Auth as the rest of the app sees it. Clerk is optional: when its keys are
 * missing, `enabled` is false and the product runs fully anonymous.
 */
export interface ClientAuth {
  enabled: boolean;
  loaded: boolean;
  signedIn: boolean;
  userId: string | null;
  name: string | null;
  imageUrl: string | null;
  openSignIn: () => void;
  openSignUp: () => void;
  openProfile: () => void;
  signOut: () => void;
}

const noop = () => {};

const DISABLED: ClientAuth = {
  enabled: false,
  loaded: true,
  signedIn: false,
  userId: null,
  name: null,
  imageUrl: null,
  openSignIn: noop,
  openSignUp: noop,
  openProfile: noop,
  signOut: noop,
};

const AuthContext = createContext<ClientAuth>(DISABLED);

export function useClientAuth(): ClientAuth {
  return useContext(AuthContext);
}

function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const value = useMemo<ClientAuth>(
    () => ({
      enabled: true,
      loaded: isLoaded,
      signedIn: !!isSignedIn,
      userId: userId ?? null,
      name: user?.username ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? null,
      imageUrl: user?.imageUrl ?? null,
      openSignIn: () => clerk.openSignIn(),
      openSignUp: () => clerk.openSignUp(),
      openProfile: () => clerk.openUserProfile(),
      signOut: () => void clerk.signOut(),
    }),
    [isLoaded, isSignedIn, userId, user, clerk],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthBridge({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) return <AuthContext.Provider value={DISABLED}>{children}</AuthContext.Provider>;
  return <ClerkBridge>{children}</ClerkBridge>;
}
