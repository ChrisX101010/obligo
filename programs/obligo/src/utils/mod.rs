use anchor_lang::prelude::*;

#[error_code]
pub enum ObligoError {
    // ── Admin ──
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Fee exceeds maximum of 10% (1000 bps)")]
    FeeTooHigh,
    #[msg("Grace period must be positive")]
    InvalidGracePeriod,

    // ── Verifier ──
    #[msg("Verifier is not active")]
    VerifierInactive,

    // ── Pool ──
    #[msg("Pool name exceeds 32 bytes")]
    PoolNameTooLong,
    #[msg("Insufficient pool liquidity")]
    InsufficientLiquidity,
    #[msg("Min discount must be > 0 and <= 5000 bps")]
    InvalidMinDiscount,
    #[msg("Max maturity must be positive")]
    InvalidMaxMaturity,

    // ── Invoice ──
    #[msg("Invoice face value is zero")]
    ZeroFaceValue,
    #[msg("Maturity must be in the future")]
    MaturityInPast,
    #[msg("Invoice ID exceeds 64 bytes")]
    InvoiceIdTooLong,
    #[msg("IPFS hash exceeds 64 bytes")]
    IpfsHashTooLong,
    #[msg("Invoice exceeds pool max invoice size")]
    InvoiceTooLarge,
    #[msg("Discount below pool minimum")]
    DiscountTooLow,
    #[msg("Invoice maturity exceeds pool maximum")]
    MaturityTooFar,
    #[msg("Invoice is not in expected status")]
    InvalidInvoiceStatus,
    #[msg("Only the debtor can repay")]
    NotDebtor,
    #[msg("Grace period has not elapsed; cannot default yet")]
    GracePeriodActive,
    #[msg("Discount bps must be > 0 and < 10000")]
    InvalidDiscount,

    // ── Position ──
    #[msg("Insufficient LP shares")]
    InsufficientShares,
    #[msg("Deposit amount is zero")]
    ZeroDeposit,
    #[msg("Withdraw amount is zero")]
    ZeroWithdraw,

    // ── Math ──
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
