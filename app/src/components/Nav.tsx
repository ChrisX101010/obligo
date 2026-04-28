'use client';

// ────────────────────────────────────────────────────────────────────────
// Top navigation. Mobile hamburger preserved. Logo links home.
// Tab links use Next.js routes (/dashboard, /pools, /invoices, /submit).
// WalletButton replaces the adapter's WalletMultiButton.
// ────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';

const WalletButton = dynamic(
  () => import('./WalletButton').then((m) => m.WalletButton),
  { ssr: false },
);

const TABS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pools', label: 'Pools' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/submit', label: 'Submit Invoice' },
] as const;

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  return (
    <nav className="border-b border-void-600 bg-void/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
        <Logo />

        <div className="hidden md:flex items-center gap-1 bg-void-800 rounded-lg p-1 border border-void-600">
          {TABS.map((tab) => {
            const active = pathname === tab.href || (pathname === '/' && tab.href === '/dashboard');
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-all',
                  active
                    ? 'bg-mint/10 text-mint border border-mint/20'
                    : 'text-gray-400 hover:text-white border border-transparent',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <WalletButton />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="md:hidden text-gray-400 hover:text-white p-2 -mr-2"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden border-t border-void-600 bg-void-800 px-4 py-3 flex flex-col gap-2"
          onClick={close}
        >
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium text-left',
                  active ? 'bg-mint/10 text-mint' : 'text-gray-400',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
