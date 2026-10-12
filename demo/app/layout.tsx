import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StrikeX · Proof of Effort",
  description: "Experience the StrikeX loop: train, validate, progress. Interactive demo with synthetic SINAPSE telemetry and optional Solana Devnet receipts.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
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
