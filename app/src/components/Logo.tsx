'use client';

// ────────────────────────────────────────────────────────────────────────
// Obligo wordmark + ring icon. Wrapped in a Next.js <Link> so the logo
// always returns to the landing page — fixes the "logo doesn't link
// home" bug on both desktop and mobile.
// ────────────────────────────────────────────────────────────────────────

import Link from 'next/link';

export function Logo() {
  return (
    <Link
      href="/"
      aria-label="Obligo home"
      className="flex items-center gap-2 sm:gap-3 min-w-0 transition-opacity hover:opacity-80"
    >
      <svg
        className="w-8 h-8 sm:w-9 sm:h-9 shrink-0"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="36" height="36" rx="8" fill="#0f0f1a" stroke="#00e6b4" strokeWidth="1.5" strokeOpacity="0.3" />
        <circle cx="18" cy="18" r="9" fill="none" stroke="#00e6b4" strokeWidth="2" />
        <circle cx="18" cy="18" r="3.5" fill="#00e6b4" />
        <line x1="18" y1="9" x2="18" y2="12" stroke="#00e6b4" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="18" y1="24" x2="18" y2="27" stroke="#00e6b4" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="9" y1="18" x2="12" y2="18" stroke="#00e6b4" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="24" y1="18" x2="27" y2="18" stroke="#00e6b4" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-display font-bold text-lg sm:text-xl text-white tracking-tight whitespace-nowrap">
          <span className="text-mint">0</span>BLIG<span className="text-mint">0</span>
        </span>
        <span className="hidden sm:inline-flex text-[10px] bg-mint/10 text-mint px-2 py-0.5 rounded-full font-mono border border-mint/20 uppercase tracking-wider ml-1">
          Devnet
        </span>
      </div>
    </Link>
  );
}
