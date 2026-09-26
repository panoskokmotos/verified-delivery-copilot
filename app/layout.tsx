import "./globals.css";
import type { ReactNode } from "react";
import { Comfortaa, Plus_Jakarta_Sans } from "next/font/google";

const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body" });
const heading = Comfortaa({ subsets: ["latin"], weight: ["700"], variable: "--font-heading" });

export const metadata = {
  title: "Verified Delivery Copilot",
  description: "Proof that a donation arrived: every donated item checked against the delivery photo by NVIDIA Nemotron on Nebius Token Factory.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Extensions like Grammarly add attributes to <html> and <body> before React loads; don't flag those.
    <html lang="en" className={`${body.variable} ${heading.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
