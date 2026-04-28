'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { DepositModal } from '@/components/DepositModal';
import { MOCK_POOLS } from '@/lib/mocks';
import type { Pool } from '@/types';
import { log } from '@/lib/log';

export default function PoolsPage() {
  const [depositPool, setDepositPool] = useState<Pool | null>(null);
  const { connected } = useWallet();

  const handleDeposit = useCallback(
    (amount: number) => {
      if (!connected) return;
      log('POOL', `Depositing ${amount} USDC to ${depositPool?.name}`, {
        amount,
        pool: depositPool?.name,
      });
      // Pass 2 will replace this toast with a real Anchor transaction.
      // For now: demo-mode confirmation. Toast surface comes from
      // wherever the parent renders Providers — this page doesn't have
      // direct toast access yet (added in Pass 2).
      // eslint-disable-next-line no-alert
      alert(
        `Demo mode: would deposit ${amount.toLocaleString()} USDC to ${depositPool?.name}.\nReal Anchor wiring lands in Pass 2.`,
      );
      setDepositPool(null);
    },
    [connected, depositPool],
  );

  return (
    <div>
      {depositPool && (
        <DepositModal
          pool={depositPool}
          onClose={() => setDepositPool(null)}
          onDeposit={handleDeposit}
        />
      )}
      <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-5 sm:mb-6">
        Lending Pools
      </h2>
      <div className="grid gap-4">
        {MOCK_POOLS.map((pool, i) => (
          <PoolCard key={pool.address} pool={pool} index={i} onDeposit={() => setDepositPool(pool)} />
        ))}
      </div>
    </div>
  );
}

function PoolCard({
  pool,
  index,
  onDeposit,
}: {
  pool: Pool;
  index: number;
  onDeposit: () => void;
}) {
  return (
    <div className="pool-card bg-void-800 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-white text-base sm:text-lg">
            {pool.name}
          </h3>
          <span className="text-[11px] sm:text-xs text-gray-500 font-mono">
            Pool #{index} · Min {pool.minDiscount}% discount · Max{' '}
            {pool.maxMaturity}d maturity
          </span>
        </div>
        <button
          onClick={() => {
            log('POOL', `Opening deposit modal for ${pool.name}`);
            onDeposit();
          }}
          type="button"
          className="w-full sm:w-auto bg-mint/10 text-mint px-5 py-2.5 rounded-lg text-sm font-display font-semibold border border-mint/20 hover:bg-mint/20 transition-all shrink-0"
        >
          Deposit
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <Stat label="TVL" value={`$${(pool.tvl / 1e6).toFixed(2)}M`} />
        <Stat label="APY" value={`${pool.apy}%`} accent />
        <Stat label="Funded" value={String(pool.invoicesFunded)} />
        <div>
          <div className="text-xs text-gray-500 mb-1">Utilization</div>
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-2 bg-void-600 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={pool.utilization}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-mint rounded-full transition-all duration-1000"
                style={{ width: `${pool.utilization}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-400">
              {pool.utilization}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div
        className={`font-display font-semibold ${accent ? 'text-mint' : 'text-white'}`}
      >
        {value}
      </div>
    </div>
  );
}
