'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatCard } from './StatCard';
import { MOCK_INVOICES, STATUS_COLORS, STEPS } from '@/lib/mocks';
import { EXPLORER_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function LandingDashboard() {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  return (
    <div>
      <section className="mb-10 md:mb-12 relative overflow-hidden rounded-2xl bg-gradient-to-br from-void-800 to-void border border-void-600 p-6 sm:p-8 md:p-12">
        <div className="absolute top-0 right-0 w-96 h-96 bg-mint/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-glow-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-mint/3 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
        <div className="relative">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-3 sm:mb-4 leading-tight">
            Invoice Factoring,
            <br />
            <span className="text-mint">On-Chain.</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-xl mb-6 sm:mb-8 leading-relaxed">
            Tokenize verified invoices as on-chain assets. Fund them through programmable lending pools. Settle automatically when paid. All on Solana.
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Link href="/submit" className="bg-mint text-void px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-display font-semibold text-sm sm:text-base hover:bg-[#00c9a0] transition-all hover:shadow-lg hover:shadow-mint/20">
              Submit Invoice
            </Link>
            <Link href="/pools" className="bg-void-800 border border-void-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-display font-semibold text-sm sm:text-base hover:border-mint/30 transition-all">
              Explore Pools
            </Link>
            <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="bg-void-800 border border-void-600 text-gray-400 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-display font-semibold text-sm sm:text-base hover:border-mint/30 hover:text-white transition-all">
              View on Explorer
            </a>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <StatCard label="Total Value Locked" value="$8.44M" sub="+12.3% this week" />
        <StatCard label="Invoices Funded" value="182" sub="47 active" />
        <StatCard label="Default Rate" value="1.2%" sub="Below industry avg" />
        <StatCard label="Avg Pool APY" value="8.8%" sub="Net of fees" />
      </div>

      <section className="bg-void-800 border border-void-600 rounded-2xl p-5 sm:p-6 md:p-8 mb-8 sm:mb-10">
        <h2 className="text-lg sm:text-xl font-display font-bold text-white mb-6 sm:mb-8">
          How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          {STEPS.map(function renderStep(step, i) {
            const expanded = expandedStep === i;
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={function () { setExpandedStep(expanded ? null : i); }}
                onKeyDown={function (e) {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedStep(expanded ? null : i);
                  }
                }}
                className="step-card rounded-xl p-4 sm:p-5 bg-void-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-mint/40"
                aria-expanded={expanded}
              >
                <div className="step-number text-2xl sm:text-3xl md:text-4xl font-display font-bold text-mint/20 mb-2 transition-all duration-500">
                  {step.num}
                </div>
                <div className="step-title font-display font-semibold text-gray-300 mb-2 transition-all duration-300">
                  {step.title}
                </div>
                <div className="text-gray-500 text-xs sm:text-sm leading-relaxed">
                  {step.desc}
                </div>
                {expanded && (
                  <div className="mt-3 pt-3 border-t border-void-600 text-mint/70 text-xs leading-relaxed animate-fade-in">
                    {step.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-void-800 border border-void-600 rounded-2xl p-5 sm:p-6 md:p-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-display font-bold text-white">
            Recent Activity
          </h2>
          <Link href="/invoices" className="text-xs sm:text-sm text-mint hover:underline font-mono">
            View all
          </Link>
        </div>
        <div className="space-y-1">
          {MOCK_INVOICES.map(function renderInvoice(inv) {
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 py-3 sm:py-4 border-b border-void-600/50 last:border-0 hover:bg-void-900/50 px-2 sm:px-3 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                  <span className="font-mono text-xs sm:text-sm text-white truncate">
                    {inv.id}
                  </span>
                  <span className={cn('text-[10px] sm:text-xs px-2 py-0.5 rounded-full border whitespace-nowrap', STATUS_COLORS[inv.status])}>
                    {inv.status}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-xs sm:text-sm text-white">
                    ${inv.faceValue.toLocaleString()}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500">
                    Due {inv.maturity}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
