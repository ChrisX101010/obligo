use anchor_lang::prelude::*;

/// Invoice status lifecycle: Submitted → Funded → Repaid → Settled
///                                          └───→ Defaulted
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum InvoiceStatus {
    /// Invoice created, awaiting pool funding.
    Submitted,
    /// Pool has purchased the invoice at a discount.
    Funded,
    /// Debtor has repaid the full face value.
    Repaid,
    /// Settlement distributed to pool after repayment.
    Settled,
    /// Past maturity + grace period with no repayment.
    Defaulted,
}

/// A tokenized invoice. PDA seeded ["invoice", invoice_index.to_le_bytes()].
///
/// SECURITY INVARIANTS:
/// - `face_value` is immutable after creation.
/// - `funded_amount` is set exactly once during fund_invoice.
/// - `verifier` must be an active verifier at submission time.
/// - `maturity_timestamp` must be in the future at submission.
/// - Status transitions are one-directional (see lifecycle above).
/// - `funded_amount < face_value` always (discount enforced).
/// - Only the `debtor` can call repay_invoice.
/// - `mark_defaulted` requires Clock::unix_timestamp > maturity + grace_period.
#[account]
#[derive(InitSpace)]
pub struct Invoice {
    /// Sequential invoice index.
    pub index: u64,
    /// The seller who submitted this invoice.
    pub seller: Pubkey,
    /// The debtor who owes payment.
    pub debtor: Pubkey,
    /// The pool that funded this invoice (set on funding).
    pub pool: Pubkey,

    // ── Financials ──
    /// Full face value of the invoice in USDC lamports.
    pub face_value: u64,
    /// Amount the pool paid to purchase the invoice (face_value - discount).
    pub funded_amount: u64,
    /// Discount rate applied (in basis points).
    pub discount_bps: u16,

    // ── Timing ──
    /// When the invoice matures (Unix timestamp).
    pub maturity_timestamp: i64,
    /// When the invoice was submitted.
    pub submitted_at: i64,
    /// When the invoice was funded.
    pub funded_at: i64,
    /// When the invoice was repaid (0 if not yet repaid).
    pub repaid_at: i64,
    /// When the invoice was settled/defaulted.
    pub resolved_at: i64,

    // ── Verification ──
    /// The verifier who attested this invoice.
    pub verifier: Pubkey,
    /// External invoice ID for off-chain correlation.
    #[max_len(64)]
    pub invoice_id: String,
    /// IPFS hash of the invoice document.
    #[max_len(64)]
    pub ipfs_hash: String,

    // ── Status ──
    pub status: InvoiceStatus,
    /// Bump seed.
    pub bump: u8,
}

impl Invoice {
    pub const SEED: &'static [u8] = b"invoice";
}
