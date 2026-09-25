import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Verified Delivery Copilot",
  description: "Proof that a donation arrived, checked by NVIDIA Nemotron on Nebius Token Factory.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
