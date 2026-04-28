'use client';

// Pure presentation. No state.

interface Props {
  label: string;
  value: string;
  sub?: string;
}

export function StatCard({ label, value, sub }: Props) {
  return (
    <div className="stat-card bg-void-800 border border-void-600 rounded-xl p-4 sm:p-6 hover:border-mint/20 transition-all duration-300">
      <div className="text-xs sm:text-sm text-gray-500 font-medium mb-1">{label}</div>
      <div className="text-xl sm:text-2xl font-display font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] sm:text-xs text-mint mt-1">{sub}</div>}
    </div>
  );
}
