import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Obligo — Invoice Factoring on Solana",
  description: "Programmable invoice-factoring protocol. Tokenize invoices, fund through pools, settle on-chain.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
