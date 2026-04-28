'use client';

import { useState } from 'react';
import type { Pool } from '@/types';

interface Props {
  pool: Pool;
  onClose: () => void;
  onDeposit: (amountUsdc: number) => void;
}

export function DepositModal({ pool, onClose, onDeposit }: Props) {
  const [amount, setAmount] = useState('');
  const numeric = Number(amount);
  const valid = numeric > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Deposit to ${pool.name}`}
    >
      <div
        className="bg-void-800 border border-void-600 rounded-2xl p-8 w-full max-w-md mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl"
          aria-label="Close"
          type="button"
        >
          &times;
        </button>
        <h3 className="font-display font-bold text-xl text-white mb-1">Deposit to {pool.name}</h3>
        <p className="text-gray-500 text-sm mb-6">
          Current APY: <span className="text-mint">{pool.apy}%</span> · TVL: ${(pool.tvl / 1e6).toFixed(2)}M
        </p>
        <label className="text-sm font-medium text-gray-400 block mb-2" htmlFor="deposit-amount">
          Amount (USDC)
        </label>
        <input
          id="deposit-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1,000"
          className="w-full bg-void border border-void-600 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-600 focus:outline-none transition-all mb-6"
        />
        <button
          onClick={() => valid && onDeposit(numeric)}
          className="w-full bg-mint text-void py-3 rounded-lg font-display font-bold hover:bg-[#00c9a0] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!valid}
          type="button"
        >
          Deposit USDC
        </button>
      </div>
    </div>
  );
}
