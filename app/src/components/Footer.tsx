'use client';

import {
  PROGRAM_ID,
  GITHUB_URL,
  DOCS_URL,
  EXPLORER_URL,
  BOUNTY_URL,
} from '@/lib/constants';
import { shortAddr } from '@/lib/utils';

export function Footer() {
  return (
    <footer className="border-t border-void-600 mt-16 sm:mt-20 py-6 sm:py-8 relative z-10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 36 36" fill="none" aria-hidden>
            <rect width="36" height="36" rx="8" fill="#0f0f1a" />
            <circle cx="18" cy="18" r="7" fill="none" stroke="#00e6b4" strokeWidth="2" />
            <circle cx="18" cy="18" r="2.5" fill="#00e6b4" />
          </svg>
          <span className="font-display text-xs sm:text-sm text-gray-500">
            Obligo Protocol · Solana Frontier Hackathon 2026
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm flex-wrap justify-center">
          <span className="text-gray-600 font-mono text-[11px] sm:text-xs">
            {shortAddr(PROGRAM_ID, 8)}
          </span>
          <span className="text-void-600">|</span>
          <FooterLink href={GITHUB_URL}>GitHub</FooterLink>
          <FooterLink href={DOCS_URL}>Docs</FooterLink>
          <FooterLink href={EXPLORER_URL}>Explorer</FooterLink>
          <FooterLink href={BOUNTY_URL}>Bounty ↗</FooterLink>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-gray-500 hover:text-mint transition-colors font-display text-xs sm:text-sm"
    >
      {children}
    </a>
  );
}
