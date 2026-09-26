"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { AuthBridge } from "@/lib/auth-client";
import { Toaster } from "./Toaster";

export function Providers({ children, authEnabled }: { children: ReactNode; authEnabled: boolean }) {
  return (
    <AuthBridge enabled={authEnabled}>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster />
      </MotionConfig>
    </AuthBridge>
  );
}
