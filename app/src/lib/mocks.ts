// ────────────────────────────────────────────────────────────────────────
// Mock data for the Obligo frontend.
//
// Pass 2 will replace these exports with live PDA reads via the Anchor
// client. By centralising them here, the swap is one-file. Any component
// that needs Pools or Invoices imports from this module — which after
// Pass 2 will become a re-export of the live hooks.
// ────────────────────────────────────────────────────────────────────────

import type { Pool, Invoice, InvoiceStatus } from '@/types';

export const MOCK_POOLS: Pool[] = [
  {
    address: 'PooLAlphaReceivables1111111111111111111111111',
    name: 'Alpha Receivables',
    tvl: 2_450_000,
    apy: 8.4,
    invoicesFunded: 47,
    utilization: 62,
    minDiscount: 5,
    maxMaturity: 90,
  },
  {
    address: 'PooLSMBTradeFinance22222222222222222222222222',
    name: 'SMB Trade Finance',
    tvl: 890_000,
    apy: 11.2,
    invoicesFunded: 23,
    utilization: 78,
    minDiscount: 7,
    maxMaturity: 60,
  },
  {
    address: 'PooLCrossBorder3333333333333333333333333333333',
    name: 'Cross-Border Pool',
    tvl: 5_100_000,
    apy: 6.9,
    invoicesFunded: 112,
    utilization: 45,
    minDiscount: 3,
    maxMaturity: 120,
  },
];

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'INV-2026-047',
    seller: '4kN2…x9Fp',
    debtor: '7bR3…mQ2z',
    faceValue: 25_000,
    fundedAmount: 23_750,
    status: 'Funded',
    maturity: '2026-05-15',
    discount: 5.0,
  },
  {
    id: 'INV-2026-048',
    seller: '9vT1…pK4w',
    debtor: '2cL8…nR7j',
    faceValue: 12_500,
    fundedAmount: 0,
    status: 'Submitted',
    maturity: '2026-06-01',
    discount: 0,
  },
  {
    id: 'INV-2026-045',
    seller: '6mW5…hD3q',
    debtor: '8eJ2…bV9t',
    faceValue: 50_000,
    fundedAmount: 46_500,
    status: 'Settled',
    maturity: '2026-04-10',
    discount: 7.0,
  },
  {
    id: 'INV-2026-041',
    seller: '3aK7…sF1y',
    debtor: '5gN4…wC6p',
    faceValue: 8_000,
    fundedAmount: 7_600,
    status: 'Repaid',
    maturity: '2026-04-18',
    discount: 5.0,
  },
];

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  Submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Funded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Repaid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Settled: 'bg-green-500/20 text-green-300 border-green-500/30',
  Defaulted: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const STEPS = [
  {
    num: '01',
    title: 'Verify',
    desc: 'Oracle verifier attests invoice authenticity off-chain, confirming the debtor and amount are legitimate.',
    detail:
      'Verifiers are registered by the protocol admin. Each verifier must co-sign the submit_invoice transaction, creating a non-replayable attestation bound to this specific invoice.',
  },
  {
    num: '02',
    title: 'Submit',
    desc: 'Seller tokenizes invoice on-chain with verifier co-signature as a PDA-backed asset.',
    detail:
      'The invoice PDA stores face value, maturity, debtor address, IPFS document hash, and verifier identity. Sequential indexing prevents seed collisions.',
  },
  {
    num: '03',
    title: 'Fund',
    desc: 'Pool manager purchases invoice at a discount, sending USDC from the pool vault to the seller.',
    detail:
      'Funding requires discount >= pool minimum, face value <= pool max, and maturity within bounds. The funded amount is calculated as face_value × (10000 - discount_bps) / 10000.',
  },
  {
    num: '04',
    title: 'Repay',
    desc: 'Debtor pays full face value before maturity. Only the debtor wallet can execute repayment.',
    detail:
      'The has_one = debtor constraint enforces that only the original debtor can repay. Full face value goes to the pool vault pending settlement.',
  },
  {
    num: '05',
    title: 'Settle',
    desc: 'Protocol distributes returns: fee to treasury, profit to pool. Permissionless — anyone can crank.',
    detail:
      'Fee is calculated on profit only (face_value - funded_amount), not the full amount. Net return increases pool NAV, benefiting all LP holders proportionally.',
  },
];
