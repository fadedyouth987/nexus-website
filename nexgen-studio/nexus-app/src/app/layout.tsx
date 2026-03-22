import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: "Nexus Studio",
  description:
    "Beta OS for AI influencers: Studio generation, planner-to-publish automation, live Instagram/Facebook OAuth, read-only Intelligence analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: avoids noise when browser extensions (e.g. that add bis_skin_checked) modify the DOM before React hydrates. */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning className="antialiased">
        <div suppressHydrationWarning>
          <Providers>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </Providers>
        </div>
      </body>
    </html>
  );
}
