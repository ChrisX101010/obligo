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
    /// Dead shares locked on first deposit to prevent inflation attack.
    /// These shares are minted to the pool itself (burned) and never redeemable.
    /// See: https://mixbytes.io/blog/overview-of-the-inflation-attack
    pub const MIN_LIQUIDITY: u64 = 1_000;

    /// Available liquidity (saturating — for display only, NEVER for accounting).
    pub fn available_liquidity(&self) -> u64 {
        self.total_deposited
            .saturating_sub(self.total_withdrawn)
            .saturating_sub(self.outstanding_funded)
            .saturating_add(self.total_returns)
            .saturating_sub(self.total_losses)
    }

    /// Available liquidity with checked arithmetic. Use this for on-chain decisions.
    /// Returns an error if accounting state is inconsistent (should be unreachable).
    pub fn available_liquidity_checked(&self) -> Result<u64> {
        let after_withdrawn = self
            .total_deposited
            .checked_sub(self.total_withdrawn)
            .ok_or(crate::utils::ObligoError::MathOverflow)?;
        let after_outstanding = after_withdrawn
            .checked_sub(self.outstanding_funded)
            .ok_or(crate::utils::ObligoError::MathOverflow)?;
        let after_returns = after_outstanding
            .checked_add(self.total_returns)
            .ok_or(crate::utils::ObligoError::MathOverflow)?;
        after_returns
            .checked_sub(self.total_losses)
            .ok_or(crate::utils::ObligoError::MathOverflow.into())
    }

    /// Net asset value (saturating — for display only).
    pub fn nav(&self) -> u64 {
        self.available_liquidity()
            .saturating_add(self.outstanding_funded)
    }

    /// Net asset value with checked arithmetic. Use this for on-chain decisions.
    pub fn nav_checked(&self) -> Result<u64> {
        self.available_liquidity_checked()?
            .checked_add(self.outstanding_funded)
            .ok_or(crate::utils::ObligoError::MathOverflow.into())
    }

    /// Price per LP share in USDC lamports (6 decimals).
    /// Returns 1_000_000 (1.0 USDC) if no shares exist.
    pub fn share_price(&self) -> Result<u64> {
        if self.total_lp_shares == 0 {
            Ok(1_000_000) // 1:1 at genesis
        } else {
            // share_price = nav * 1e6 / total_lp_shares
            let nav = self.nav_checked()? as u128;
            nav.checked_mul(1_000_000)
                .ok_or(crate::utils::ObligoError::MathOverflow)?
                .checked_div(self.total_lp_shares as u128)
                .ok_or(crate::utils::ObligoError::MathOverflow.into())
                .map(|x| x as u64)
        }
    }

    /// LP shares to mint for a given deposit amount.
    /// Returns (user_shares, dead_shares) — dead_shares is MIN_LIQUIDITY on first
    /// deposit (locked forever), 0 on subsequent deposits.
    pub fn shares_for_deposit(&self, amount: u64) -> Result<(u64, u64)> {
        if self.total_lp_shares == 0 {
            // First deposit: mint MIN_LIQUIDITY dead shares + (amount - MIN_LIQUIDITY) to user.
            // This prevents the inflation/donation attack where a first depositor
            // with 1 share can manipulate share_price for subsequent depositors.
            let user_shares = amount
                .checked_sub(Self::MIN_LIQUIDITY)
                .ok_or(crate::utils::ObligoError::FirstDepositTooSmall)?;
            require!(user_shares > 0, crate::utils::ObligoError::FirstDepositTooSmall);
            Ok((user_shares, Self::MIN_LIQUIDITY))
        } else {
            let shares = (amount as u128)
                .checked_mul(self.total_lp_shares as u128)
                .ok_or(crate::utils::ObligoError::MathOverflow)?
                .checked_div(self.nav_checked()? as u128)
                .ok_or(crate::utils::ObligoError::MathOverflow)? as u64;
            Ok((shares, 0))
        }
    }

    /// USDC value of a given number of LP shares.
    pub fn value_of_shares(&self, shares: u64) -> Result<u64> {
        if self.total_lp_shares == 0 {
            Ok(0)
        } else {
            let nav = self.nav_checked()? as u128;
            (shares as u128)
                .checked_mul(nav)
                .ok_or(crate::utils::ObligoError::MathOverflow)?
                .checked_div(self.total_lp_shares as u128)
                .ok_or(crate::utils::ObligoError::MathOverflow.into())
                .map(|x| x as u64)
        }
    }
}
