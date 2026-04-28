// ────────────────────────────────────────────────────────────────────────
// Small UI/format helpers shared across components.
// ────────────────────────────────────────────────────────────────────────

/**
 * tailwind-merge style className concatenation. Lighter than `clsx`
 * because we don't need the priority logic for our use case.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * "Bx9d…uGzn" — 4 chars + ellipsis + last 4 chars by default.
 * Used everywhere we display a wallet pubkey or PDA address.
 */
export function shortAddr(addr: string, chars = 4): string {
  if (!addr || addr.length <= chars * 2 + 1) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatUsd(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function formatCompactUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
