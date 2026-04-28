import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { CursorGlow } from '@/components/CursorGlow';
import { LatticeBackground } from '@/components/LatticeBackground';

export const metadata: Metadata = {
  title: 'Obligo — Invoice Factoring on Solana',
  description:
    'Programmable invoice-factoring protocol. Tokenize invoices, fund through pools, settle on-chain.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'Obligo',
    description: 'Programmable invoice factoring on Solana.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#06060b',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-void text-gray-300 min-h-screen">
        <Providers>
          <LatticeBackground />
          <CursorGlow />
          <Nav />
          <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10 min-h-[calc(100vh-200px)]">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
