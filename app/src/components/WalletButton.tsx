'use client';

// ────────────────────────────────────────────────────────────────────────
// Custom wallet button — port of Foresight's WalletButton, themed for
// Obligo's mint-on-void palette.
//
// Replaces @solana/wallet-adapter-react-ui's <WalletMultiButton/> for two
// reasons that came up in Foresight's polish round:
//   1. The adapter dropdown is pinned to button's right edge — design
//      requires it centered under the trigger.
//   2. Adapter's post-disconnect copy is inconsistent across versions.
//      We control the toasts via Providers.tsx instead.
//
// We still use the adapter's WalletModal for selection — only the
// connected-state button + dropdown are custom.
// ────────────────────────────────────────────────────────────────────────

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn, shortAddr } from '@/lib/utils';

export function WalletButton() {
  const { publicKey, wallet, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape (a11y).
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleCopy = useCallback(async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
    } catch {
      /* clipboard refused — toast handled by parent if desired */
    }
    setOpen(false);
  }, [publicKey]);

  const handleChange = useCallback(async () => {
    setOpen(false);
    try {
      await disconnect();
    } catch {
      /* ignore — modal opens regardless */
    }
    setVisible(true);
  }, [disconnect, setVisible]);

  const handleDisconnect = useCallback(async () => {
    setOpen(false);
    try {
      await disconnect();
      // Toast is fired by Providers.tsx on the connected→disconnected
      // transition — DO NOT also toast here, that's the bug we ported in.
    } catch {
      /* swallow — Providers' onError will surface it if relevant */
    }
  }, [disconnect]);

  // Disconnected → Connect CTA opens the adapter modal.
  if (!connected || !publicKey) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={connecting}
        className={cn(
          'flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition min-w-[148px]',
          'bg-mint text-void hover:bg-[#00c9a0]',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          'font-display',
        )}
      >
        <WalletIcon />
        {connecting ? 'Connecting…' : 'Connect wallet'}
      </button>
    );
  }

  const addr = publicKey.toBase58();
  const walletIconUrl = wallet?.adapter.icon;

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 transition min-w-[148px]',
          'bg-mint text-void hover:bg-[#00c9a0]',
          'font-mono text-xs font-medium',
        )}
      >
        {walletIconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={walletIconUrl} alt="" width={16} height={16} className="rounded-sm" />
        ) : (
          <WalletIcon />
        )}
        <span>{shortAddr(addr, 4)}</span>
        <ChevronIcon className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          // CENTERING: left-1/2 + -translate-x-1/2 anchors the menu under
          // the trigger regardless of trigger width. top-full + mt-2 below.
          className={cn(
            'absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2',
            'min-w-[220px] rounded-xl bg-void-800 p-1.5 shadow-2xl',
            'ring-1 ring-void-600',
          )}
        >
          <div className="px-3 py-2 border-b border-void-600 mb-1">
            <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              {wallet?.adapter.name ?? 'Wallet'}
            </div>
            <div className="font-mono text-xs text-white truncate">{shortAddr(addr, 6)}</div>
          </div>

          <MenuItem onClick={handleCopy} icon={<CopyIcon />}>
            Copy address
          </MenuItem>
          <MenuItem onClick={handleChange} icon={<RefreshIcon />}>
            Change wallet
          </MenuItem>
          <MenuItem onClick={handleDisconnect} icon={<LogoutIcon />} danger>
            Disconnect
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
  icon,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
        'hover:bg-void-700',
        danger ? 'text-red-400 hover:text-red-300' : 'text-white',
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

// ── Inline icons (avoids pulling in lucide-react just for these) ──

function WalletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
