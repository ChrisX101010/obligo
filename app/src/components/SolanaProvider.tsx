'use client';

// ────────────────────────────────────────────────────────────────────────
// Solana wallet + connection provider for Obligo (devnet).
//
// Ports the SSR-safe pattern from Foresight:
//   - Always mount WalletProvider (so useWallet() doesn't throw on SSR).
//   - autoConnect is true (modal needs it to complete connect handshake).
//   - On the LANDING page only, clear the stale walletName from
//     localStorage on first visit per session — prevents the cold-load
//     auto-prompt that confuses first-time visitors.
//
// Adapter list:
//   - Phantom (was already there)
//   - Solflare (added — bounty sponsor parity with Foresight)
// ────────────────────────────────────────────────────────────────────────

import { ReactNode, useCallback, useEffect, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
  WalletAdapterNetwork,
  WalletError,
} from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';
import { STORAGE_KEYS } from '@/lib/constants';
import { log } from '@/lib/log';

const NETWORK = WalletAdapterNetwork.Devnet;

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl(NETWORK);

const SILENT_ERRORS = new Set([
  'WalletNotReadyError',
  'WalletNotSelectedError',
  'WalletConnectionError',
  'WalletWindowClosedError',
  'WalletWindowBlockedError',
]);

/**
 * Clears the stale walletName key on the very first mount of the
 * landing page in a session, so cold visitors aren't auto-prompted.
 * Once the user has actively connected once (Providers.tsx writes the
 * session flag), this no-ops.
 */
function useSuppressLandingAutoConnect() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isLanding = window.location.pathname === '/';
    if (!isLanding) return;
    const hasSessionFlag =
      sessionStorage.getItem(STORAGE_KEYS.sessionUsed) === '1';
    if (hasSessionFlag) return;
    try {
      localStorage.removeItem(STORAGE_KEYS.walletName);
    } catch {
      /* private mode — non-fatal */
    }
  }, []);
}

interface Props {
  children: ReactNode;
  /** Optional toast hook from <Providers/>. Surface non-silent wallet errors. */
  onError?: (error: WalletError) => void;
}

export function SolanaProvider({ children, onError: externalOnError }: Props) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: NETWORK }),
    ],
    [],
  );

  useSuppressLandingAutoConnect();

  const onError = useCallback(
    (error: WalletError) => {
      if (SILENT_ERRORS.has(error.name)) {
        log('WALLET', `silent: ${error.name}`);
        return;
      }
      log('WALLET', `error: ${error.name}`, error.message);
      externalOnError?.(error);
    },
    [externalOnError],
  );

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: 'confirmed' }}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
