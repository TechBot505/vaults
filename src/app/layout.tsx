import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "@fontsource-variable/unbounded";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Shell } from "@/components/shell/Shell";
import { Providers } from "@/components/Providers";
import { clerkEnabled } from "@/server/env";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.URL /* Netlify */ ?? "http://localhost:3000"),
  ),
  title: { default: "VAULTS · build a vault nobody can crack", template: "%s · VAULTS" },
  description: "A turn-based heist game. Crack impossible vaults, then build your own and dare the internet to break in.",
  openGraph: { title: "VAULTS", description: "Build a vault nobody can crack.", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#050d19",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const app = (
    <Providers authEnabled={clerkEnabled}>
      <Shell>{children}</Shell>
    </Providers>
  );
  return (
    <html lang="en">
      <body className="blueprint grain">
        {clerkEnabled ? (
          <ClerkProvider appearance={{ variables: { colorPrimary: "#5fd4ff", colorBackground: "#0a1628", borderRadius: "6px" } }}>
            {app}
          </ClerkProvider>
        ) : (
          app
        )}
      </body>
    </html>
  );
}
