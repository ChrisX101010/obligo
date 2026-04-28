'use client';

import { MOCK_INVOICES, STATUS_COLORS } from '@/lib/mocks';
import { cn } from '@/lib/utils';

export default function InvoicesPage() {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-5 sm:mb-6">
        Invoice Registry
      </h2>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-3">
        {MOCK_INVOICES.map((inv) => (
          <div key={inv.id} className="bg-void-800 border border-void-600 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-sm text-white">{inv.id}</span>
              <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[inv.status])}>
                {inv.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Face" value={`$${inv.faceValue.toLocaleString()}`} />
              <Field
                label="Funded"
                value={inv.fundedAmount > 0 ? `$${inv.fundedAmount.toLocaleString()}` : '—'}
              />
              <Field
                label="Discount"
                value={inv.discount > 0 ? `${inv.discount}%` : '—'}
              />
              <Field label="Due" value={inv.maturity} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-void-800 border border-void-600 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-void-900">
            <tr>
              {['Invoice', 'Seller', 'Debtor', 'Face Value', 'Funded', 'Discount', 'Maturity', 'Status'].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-display font-medium text-gray-500 px-4 py-3 border-b border-void-600"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {MOCK_INVOICES.map((inv) => (
              <tr
                key={inv.id}
                className="border-b border-void-600/50 hover:bg-void-900/50 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-sm text-white">{inv.id}</td>
                <td className="px-4 py-3 text-sm text-gray-400 font-mono">{inv.seller}</td>
                <td className="px-4 py-3 text-sm text-gray-400 font-mono">{inv.debtor}</td>
                <td className="px-4 py-3 text-sm font-mono text-white">
                  ${inv.faceValue.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-white">
                  {inv.fundedAmount > 0 ? `$${inv.fundedAmount.toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-400">
                  {inv.discount > 0 ? `${inv.discount}%` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{inv.maturity}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLORS[inv.status])}
                  >
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>{' '}
      <span className="text-white">{value}</span>
    </div>
  );
}
