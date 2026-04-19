use anchor_lang::prelude::*;

/// A lender's position in a pool.
/// PDA seeded ["position", pool.key(), lender.key()].
///
/// SECURITY INVARIANTS:
/// - `lp_shares` cannot go negative (checked subtraction on withdraw).
/// - Only the `lender` can withdraw or close this position.
/// - Share arithmetic uses 128-bit intermediaries to prevent overflow.
#[account]
#[derive(InitSpace)]
pub struct Position {
    /// The pool this position is in.
    pub pool: Pubkey,
    /// The lender who owns this position.
    pub lender: Pubkey,
    /// Number of LP shares held.
    pub lp_shares: u64,
    /// Total USDC deposited (lifetime).
    pub total_deposited: u64,
    /// Total USDC withdrawn (lifetime).
    pub total_withdrawn: u64,
    /// When the position was opened.
    pub opened_at: i64,
    /// Bump seed.
    pub bump: u8,
}

impl Position {
    pub const SEED: &'static [u8] = b"position";
}
