'use client';

// ────────────────────────────────────────────────────────────────────────
// Top-level UI wrappers: Solana, toasts, query client (added in Pass 2).
//
// Single-source wallet toast via stable id — the connect/disconnect
// transitions update one toast slot rather than stacking, which fixes
// the "Connected: ..." flash on disconnect that was Obligo's bug #1.
// ────────────────────────────────────────────────────────────────────────

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError } from '@solana/wallet-adapter-base';
import { SolanaProvider } from './SolanaProvider';
import { Toast, ToastViewport, useToastQueue } from './Toast';
import { STORAGE_KEYS } from '@/lib/constants';
import { log } from '@/lib/log';
import { shortAddr } from '@/lib/utils';

/**
 * Watches wallet state and emits exactly one toast per
 * connected→disconnected and disconnected→connected transition.
 *
 * Uses lastKey ref to gate so:
 *   - Same-key reconnect doesn't refire
 *   - Disconnect only fires if we previously had a key
 *   - Wallet swap fires once for the new key
 */
function WalletStatusWatcher({ pushToast }: { pushToast: ReturnType<typeof useToastQueue>['push'] }) {
  const { connected, publicKey, wallet } = useWallet();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const key = publicKey?.toBase58() ?? null;

    if (connected && key && key !== lastKey.current) {
      pushToast({
        id: 'wallet-status',
        message: `${wallet?.adapter.name ?? 'Wallet'} connected`,
        description: shortAddr(key, 6),
        type: 'success',
      });
      lastKey.current = key;
      try {
        sessionStorage.setItem(STORAGE_KEYS.sessionUsed, '1');
      } catch {
        /* private mode — non-fatal */
      }
      log('WALLET', `connected ${key}`);
      return;
    }

    if (!connected && lastKey.current) {
      pushToast({
        id: 'wallet-status',
        message: 'Wallet disconnected',
        description: 'You can reconnect anytime.',
        type: 'info',
      });
      log('WALLET', `disconnected ${lastKey.current}`);
      lastKey.current = null;
    }
  }, [connected, publicKey, wallet, pushToast]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const toasts = useToastQueue();

  const onWalletError = useCallback(
    (error: WalletError) => {
      toasts.push({
        id: `wallet-error-${error.name}`,
        message: error.message || 'Wallet error',
        description: error.name,
        type: 'error',
      });
    },
    [toasts],
  );

  return (
    <SolanaProvider onError={onWalletError}>
      <WalletStatusWatcher pushToast={toasts.push} />
      {children}
      <ToastViewport toasts={toasts.items} dismiss={toasts.dismiss} />
    </SolanaProvider>
  );
}
