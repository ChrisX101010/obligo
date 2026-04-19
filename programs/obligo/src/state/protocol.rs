use anchor_lang::prelude::*;

/// Global protocol configuration. Singleton PDA seeded ["protocol"].
///
/// SECURITY INVARIANTS:
/// - Only `admin` may modify this account.
/// - `fee_bps` must be <= 1000 (10%) to prevent griefing.
/// - `paused` gates all user-facing instructions.
/// - `grace_period_seconds` is the time after maturity before an invoice
///   can be marked defaulted; must be > 0 to prevent front-running.
#[account]
#[derive(InitSpace)]
pub struct Protocol {
    /// The admin pubkey, set at init and transferable.
    pub admin: Pubkey,
    /// Protocol fee in basis points, taken from settlement proceeds.
    pub fee_bps: u16,
    /// Grace period (seconds) after maturity before default can be called.
    pub grace_period_seconds: i64,
    /// Emergency pause flag.
    pub paused: bool,
    /// Treasury that collects protocol fees.
    pub treasury: Pubkey,
    /// Running counter for pool IDs.
    pub pool_count: u64,
    /// Running counter for invoice IDs.
    pub invoice_count: u64,
    /// Bump seed for this PDA.
    pub bump: u8,
}

impl Protocol {
    pub const SEED: &'static [u8] = b"protocol";
    pub const MAX_FEE_BPS: u16 = 1_000; // 10% cap
}
