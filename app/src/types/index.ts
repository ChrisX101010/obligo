// ────────────────────────────────────────────────────────────────────────
// Domain types for the Obligo frontend. Mirrors the Anchor program's
// Pool / Invoice account layouts at the field level, but kept independent
// so UI code doesn't import directly from generated IDL types (they
// regenerate often and have BN/PublicKey types we'd need to convert).
// The mapping happens in app/src/lib/anchor-client.ts (Pass 2).
// ────────────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | 'Submitted'
  | 'Funded'
  | 'Repaid'
  | 'Settled'
  | 'Defaulted';

export interface Pool {
  /** PDA address. */
  address: string;
  name: string;
  /** Total USDC managed. */
  tvl: number;
  /** Annualised yield to LPs, expressed as percentage (e.g. 8.4 for 8.4%). */
  apy: number;
  /** How many invoices this pool has historically funded. */
  invoicesFunded: number;
  /** Currently-deployed capital / TVL × 100. */
  utilization: number;
  /** Minimum discount (bps / 100) the pool will fund. */
  minDiscount: number;
  /** Maximum days-to-maturity the pool will accept. */
  maxMaturity: number;
}

export interface Invoice {
  /** Human-readable id (INV-2026-047). */
  id: string;
  /** PDA address of the on-chain Invoice account. */
  pda?: string;
  /** Seller wallet, shortened. */
  seller: string;
  /** Debtor wallet, shortened. */
  debtor: string;
  faceValue: number;
  /** USDC actually disbursed to seller (face value × (1 - discount)). */
  fundedAmount: number;
  status: InvoiceStatus;
  /** ISO date string. */
  maturity: string;
  /** Discount as percentage. */
  discount: number;
  /** IPFS hash of the invoice document. Empty for unsubmitted forms. */
  ipfsHash?: string;
}

export interface InvoiceFormState {
  invoiceId: string;
  faceValue: string;
  maturityDate: string;
  debtor: string;
  ipfsHash: string;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
