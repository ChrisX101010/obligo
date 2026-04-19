use anchor_lang::prelude::*;

/// An isolated lending pool. PDA seeded ["pool", pool_index.to_le_bytes()].
///
/// Each pool has its own risk parameters and independent accounting.
/// Lenders deposit USDC and receive LP shares proportional to the pool's
/// total value (deposits - outstanding funded invoices + settled returns).
///
/// SECURITY INVARIANTS:
/// - `total_deposits` must always equal sum of all Position.deposited amounts
///   minus all withdrawals. Checked via CPI transfer amounts.
/// - `outstanding_funded` tracks capital currently locked in funded invoices.
///   Must decrease on settlement or default.
/// - LP share math uses checked arithmetic to prevent overflow.
/// - `max_invoice_size` prevents a single invoice from draining the pool.
/// - Withdrawals must not bring available liquidity below outstanding_funded.
#[account]
#[derive(InitSpace)]
pub struct Pool {
    /// Sequential pool index.
    pub index: u64,
    /// Pool creator / manager.
    pub manager: Pubkey,
    /// Human-readable pool name (max 32 bytes).
    #[max_len(32)]
    pub name: String,

    // ── Risk Parameters ──
    /// Maximum face value of a single invoice this pool will fund.
    pub max_invoice_size: u64,
    /// Minimum discount in bps the pool requires (floor for fund_invoice).
    pub min_discount_bps: u16,
    /// Maximum maturity duration (seconds from now) the pool accepts.
    pub max_maturity_seconds: i64,

    // ── Accounting ──
    /// Total USDC deposited (lifetime, not reduced by withdrawals).
    pub total_deposited: u64,
    /// Total USDC withdrawn (lifetime).
    pub total_withdrawn: u64,
    /// USDC currently locked in funded, unsettled invoices.
    pub outstanding_funded: u64,
    /// Total LP shares minted (live supply).
    pub total_lp_shares: u64,
    /// Accumulated settled returns (face_value - funded_amount portions).
    pub total_returns: u64,
    /// Accumulated losses from defaults.
    pub total_losses: u64,

    // ── Token accounts ──
    /// The pool's USDC vault (ATA owned by pool PDA).
    pub vault: Pubkey,
    /// The USDC mint accepted by this pool.
    pub usdc_mint: Pubkey,

    // ── Metadata ──
    /// Number of invoices funded by this pool.
    pub invoices_funded: u64,
    /// Creation timestamp.
    pub created_at: i64,
    /// Bump seed.
    pub bump: u8,
}

impl Pool {
    pub const SEED: &'static [u8] = b"pool";

    /// Available liquidity = deposits - withdrawals - outstanding + returns - losses
    pub fn available_liquidity(&self) -> u64 {
        self.total_deposited
            .saturating_sub(self.total_withdrawn)
            .saturating_sub(self.outstanding_funded)
            .saturating_add(self.total_returns)
            .saturating_sub(self.total_losses)
    }

    /// Net asset value = available_liquidity + outstanding_funded
    pub fn nav(&self) -> u64 {
        self.available_liquidity()
            .saturating_add(self.outstanding_funded)
    }

    /// Price per LP share in USDC lamports (6 decimals).
    /// Returns 1_000_000 (1.0 USDC) if no shares exist.
    pub fn share_price(&self) -> u64 {
        if self.total_lp_shares == 0 {
            1_000_000 // 1:1 at genesis
        } else {
            // share_price = nav * 1e6 / total_lp_shares
            (self.nav() as u128)
                .checked_mul(1_000_000)
                .unwrap()
                .checked_div(self.total_lp_shares as u128)
                .unwrap() as u64
        }
    }

    /// LP shares to mint for a given deposit amount.
    pub fn shares_for_deposit(&self, amount: u64) -> u64 {
        if self.total_lp_shares == 0 {
            amount // 1:1 at genesis
        } else {
            // shares = amount * total_shares / nav
            (amount as u128)
                .checked_mul(self.total_lp_shares as u128)
                .unwrap()
                .checked_div(self.nav() as u128)
                .unwrap() as u64
        }
    }

    /// USDC value of a given number of LP shares.
    pub fn value_of_shares(&self, shares: u64) -> u64 {
        if self.total_lp_shares == 0 {
            0
        } else {
            (shares as u128)
                .checked_mul(self.nav() as u128)
                .unwrap()
                .checked_div(self.total_lp_shares as u128)
                .unwrap() as u64
        }
    }
}
