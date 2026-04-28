// ────────────────────────────────────────────────────────────────────────
// External URLs and on-chain constants surfaced in the UI.
// Single source of truth for the address that's shown in the footer,
// the explorer link, etc.
// ────────────────────────────────────────────────────────────────────────

export const PROGRAM_ID = 'G2U6oqyujU8xWFwXMeejavMCbYYJNRSqromMJrYH5a3W';

export const GITHUB_URL = 'https://github.com/ChrisX101010/obligo';

export const DOCS_URL =
  'https://github.com/ChrisX101010/obligo/blob/main/docs/ARCHITECTURE.md';

export const EXPLORER_URL = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`;

export const BOUNTY_URL =
  'https://superteam.fun/earn/listing/50k-adevarlabs-bounty';

/** Network used by the Obligo dApp — devnet because the Anchor program is deployed there. */
export const SOLANA_NETWORK = 'devnet' as const;

/** Localstorage / sessionstorage keys, namespaced. */
export const STORAGE_KEYS = {
  walletName: 'walletName',
  sessionUsed: 'obligo:wallet-used',
} as const;
