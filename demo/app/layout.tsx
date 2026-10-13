import type { Metadata } from "next";
import "./globals.css";
import "@/components/strikex/brand.css";
import "@/components/strikex/onboarding.css";
import "@/components/strikex/system.css";

export const metadata: Metadata = {
  title: "StrikeX · Proof of Effort",
  description: "Experience the StrikeX loop: train, validate, progress. Interactive demo with synthetic SINAPSE telemetry and optional Solana Devnet receipts.",
  icons: {
    icon: "/brand/strikex-logo.png",
    shortcut: "/brand/strikex-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
