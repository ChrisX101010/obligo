use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::*;
use crate::utils::ObligoError;

// ── Submit Invoice ─────────────────────────────────────────────────────

/// Submit a new invoice for factoring. Requires verifier co-signature.
///
/// SECURITY: The verifier must be active AND must sign this transaction.
/// This prevents replay of old verifier attestations and ensures
/// the verifier actively approved this specific invoice.
pub fn submit_invoice(
    ctx: Context<SubmitInvoice>,
    face_value: u64,
    maturity_timestamp: i64,
    debtor: Pubkey,
    invoice_id: String,
    ipfs_hash: String,
) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, ObligoError::ProtocolPaused);
    require!(face_value > 0, ObligoError::ZeroFaceValue);
    require!(invoice_id.len() <= 64, ObligoError::InvoiceIdTooLong);
    require!(ipfs_hash.len() <= 64, ObligoError::IpfsHashTooLong);

    let clock = Clock::get()?;
    require!(maturity_timestamp > clock.unix_timestamp, ObligoError::MaturityInPast);

    // Verifier must be active.
    require!(ctx.accounts.verifier.active, ObligoError::VerifierInactive);

    let protocol = &mut ctx.accounts.protocol;
    let invoice = &mut ctx.accounts.invoice;
    let verifier = &mut ctx.accounts.verifier;

    invoice.index = protocol.invoice_count;
    invoice.seller = ctx.accounts.seller.key();
    invoice.debtor = debtor;
    invoice.pool = Pubkey::default(); // Set on funding
    invoice.face_value = face_value;
    invoice.funded_amount = 0;
    invoice.discount_bps = 0;
    invoice.maturity_timestamp = maturity_timestamp;
    invoice.submitted_at = clock.unix_timestamp;
    invoice.funded_at = 0;
    invoice.repaid_at = 0;
    invoice.resolved_at = 0;
    invoice.verifier = ctx.accounts.verifier_signer.key();
    invoice.invoice_id = invoice_id;
    invoice.ipfs_hash = ipfs_hash;
    invoice.status = InvoiceStatus::Submitted;
    invoice.bump = ctx.bumps.invoice;

    verifier.attestation_count = verifier
        .attestation_count
        .checked_add(1)
        .ok_or(ObligoError::MathOverflow)?;

    protocol.invoice_count = protocol
        .invoice_count
        .checked_add(1)
        .ok_or(ObligoError::MathOverflow)?;

    msg!(
        "Invoice #{} submitted: {} USDC, matures at {}",
        invoice.index,
        face_value,
        maturity_timestamp
    );
    Ok(())
}

#[derive(Accounts)]
pub struct SubmitInvoice<'info> {
    #[account(
        mut,
        seeds = [Protocol::SEED],
        bump = protocol.bump,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        init,
        payer = seller,
        space = 8 + Invoice::INIT_SPACE,
        seeds = [Invoice::SEED, protocol.invoice_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub invoice: Account<'info, Invoice>,

    /// The verifier PDA — checked to be active.
    #[account(
        mut,
        seeds = [Verifier::SEED, verifier_signer.key().as_ref()],
        bump = verifier.bump,
    )]
    pub verifier: Account<'info, Verifier>,

    /// The verifier's wallet must co-sign.
    pub verifier_signer: Signer<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ── Fund Invoice ───────────────────────────────────────────────────────

/// Pool manager purchases an invoice at the given discount.
///
/// SECURITY CHECKS:
/// 1. Invoice must be in Submitted status (prevents double-funding).
/// 2. discount_bps > 0 and < 10000.
/// 3. discount_bps >= pool.min_discount_bps.
/// 4. face_value <= pool.max_invoice_size.
/// 5. Maturity within pool's max_maturity_seconds from now.
/// 6. Pool has sufficient available liquidity.
/// 7. funded_amount = face_value * (10000 - discount_bps) / 10000.
pub fn fund_invoice(ctx: Context<FundInvoice>, discount_bps: u16) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, ObligoError::ProtocolPaused);

    let invoice = &ctx.accounts.invoice;
    let pool = &ctx.accounts.pool;
    let clock = Clock::get()?;

    // Status check.
    require!(invoice.status == InvoiceStatus::Submitted, ObligoError::InvalidInvoiceStatus);

    // Discount validation.
    require!(discount_bps > 0 && discount_bps < 10000, ObligoError::InvalidDiscount);
    require!(discount_bps >= pool.min_discount_bps, ObligoError::DiscountTooLow);

    // Size check.
    require!(invoice.face_value <= pool.max_invoice_size, ObligoError::InvoiceTooLarge);

    // Maturity check.
    let time_to_maturity = invoice
        .maturity_timestamp
        .checked_sub(clock.unix_timestamp)
        .ok_or(ObligoError::MaturityInPast)?;
    require!(time_to_maturity > 0, ObligoError::MaturityInPast);
    require!(time_to_maturity <= pool.max_maturity_seconds, ObligoError::MaturityTooFar);

    // Calculate funded amount (checked arithmetic).
    let funded_amount = (invoice.face_value as u128)
        .checked_mul((10000u128).checked_sub(discount_bps as u128).unwrap())
        .ok_or(ObligoError::MathOverflow)?
        .checked_div(10000)
        .ok_or(ObligoError::MathOverflow)? as u64;

    // Liquidity check.
    require!(
        funded_amount <= pool.available_liquidity(),
        ObligoError::InsufficientLiquidity
    );

    // Transfer USDC from pool vault to seller.
    let pool_index_bytes = pool.index.to_le_bytes();
    let seeds: &[&[u8]] = &[Pool::SEED, &pool_index_bytes, &[pool.bump]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.seller_usdc.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            &[seeds],
        ),
        funded_amount,
    )?;

    // Update invoice.
    let invoice = &mut ctx.accounts.invoice;
    invoice.pool = ctx.accounts.pool.key();
    invoice.funded_amount = funded_amount;
    invoice.discount_bps = discount_bps;
    invoice.funded_at = clock.unix_timestamp;
    invoice.status = InvoiceStatus::Funded;

    // Update pool.
    let pool = &mut ctx.accounts.pool;
    pool.outstanding_funded = pool
        .outstanding_funded
        .checked_add(funded_amount)
        .ok_or(ObligoError::MathOverflow)?;
    pool.invoices_funded = pool
        .invoices_funded
        .checked_add(1)
        .ok_or(ObligoError::MathOverflow)?;

    msg!(
        "Invoice #{} funded: {} USDC at {}bps discount by pool #{}",
        invoice.index,
        funded_amount,
        discount_bps,
        pool.index
    );
    Ok(())
}

#[derive(Accounts)]
pub struct FundInvoice<'info> {
    #[account(
        seeds = [Protocol::SEED],
        bump = protocol.bump,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        mut,
        seeds = [Pool::SEED, pool.index.to_le_bytes().as_ref()],
        bump = pool.bump,
        has_one = manager,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        address = pool.vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [Invoice::SEED, invoice.index.to_le_bytes().as_ref()],
        bump = invoice.bump,
    )]
    pub invoice: Account<'info, Invoice>,

    /// Seller's USDC account to receive funds.
    #[account(
        mut,
        constraint = seller_usdc.mint == pool.usdc_mint,
        constraint = seller_usdc.owner == invoice.seller,
    )]
    pub seller_usdc: Account<'info, TokenAccount>,

    /// Pool manager must authorize funding.
    pub manager: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ── Repay Invoice ──────────────────────────────────────────────────────

/// Debtor repays the full face value of the invoice.
///
/// SECURITY: Only the debtor can repay. Full face value is required.
/// The USDC goes to an escrow (the pool vault) pending settlement.
pub fn repay_invoice(ctx: Context<RepayInvoice>) -> Result<()> {
    let invoice = &ctx.accounts.invoice;

    require!(invoice.status == InvoiceStatus::Funded, ObligoError::InvalidInvoiceStatus);

    // Transfer full face_value from debtor to pool vault.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.debtor_usdc.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.debtor.to_account_info(),
            },
        ),
        invoice.face_value,
    )?;

    let invoice = &mut ctx.accounts.invoice;
    invoice.repaid_at = Clock::get()?.unix_timestamp;
    invoice.status = InvoiceStatus::Repaid;

    msg!("Invoice #{} repaid: {} USDC", invoice.index, invoice.face_value);
    Ok(())
}

#[derive(Accounts)]
pub struct RepayInvoice<'info> {
    #[account(
        mut,
        seeds = [Invoice::SEED, invoice.index.to_le_bytes().as_ref()],
        bump = invoice.bump,
        has_one = debtor,
    )]
    pub invoice: Account<'info, Invoice>,

    #[account(
        mut,
        seeds = [Pool::SEED, pool.index.to_le_bytes().as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        address = pool.vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = debtor_usdc.mint == pool.usdc_mint,
        constraint = debtor_usdc.owner == debtor.key(),
    )]
    pub debtor_usdc: Account<'info, TokenAccount>,

    /// The debtor must sign repayment.
    pub debtor: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ── Settle Invoice ─────────────────────────────────────────────────────

/// After repayment, distribute proceeds: protocol fee to treasury,
/// remainder updates pool accounting (returns).
///
/// SECURITY: Can only be called on Repaid invoices. Fee is calculated
/// on the profit (face_value - funded_amount), not the full amount.
/// Protocol fee is transferred to treasury via pool PDA signer.
pub fn settle_invoice(ctx: Context<SettleInvoice>) -> Result<()> {
    let invoice = &ctx.accounts.invoice;

    require!(invoice.status == InvoiceStatus::Repaid, ObligoError::InvalidInvoiceStatus);

    let protocol = &ctx.accounts.protocol;
    let pool = &ctx.accounts.pool;

    // Profit = face_value - funded_amount (the discount earned by the pool).
    let profit = invoice
        .face_value
        .checked_sub(invoice.funded_amount)
        .ok_or(ObligoError::MathOverflow)?;

    // Protocol fee on the profit.
    let fee = (profit as u128)
        .checked_mul(protocol.fee_bps as u128)
        .ok_or(ObligoError::MathOverflow)?
        .checked_div(10000)
        .ok_or(ObligoError::MathOverflow)? as u64;

    // Transfer fee to treasury.
    if fee > 0 {
        let pool_index_bytes = pool.index.to_le_bytes();
        let seeds: &[&[u8]] = &[Pool::SEED, &pool_index_bytes, &[pool.bump]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.treasury_usdc.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[seeds],
            ),
            fee,
        )?;
    }

    // Net return to pool = face_value - fee
    // But the pool only had funded_amount locked, so the actual return
    // credited is: face_value - fee - funded_amount
    // And we also release the outstanding_funded.
    let net_return = invoice
        .face_value
        .checked_sub(fee)
        .ok_or(ObligoError::MathOverflow)?
        .checked_sub(invoice.funded_amount)
        .ok_or(ObligoError::MathOverflow)?;

    let pool = &mut ctx.accounts.pool;
    pool.outstanding_funded = pool
        .outstanding_funded
        .checked_sub(invoice.funded_amount)
        .ok_or(ObligoError::MathOverflow)?;
    pool.total_returns = pool
        .total_returns
        .checked_add(net_return)
        .ok_or(ObligoError::MathOverflow)?;

    let invoice = &mut ctx.accounts.invoice;
    invoice.resolved_at = Clock::get()?.unix_timestamp;
    invoice.status = InvoiceStatus::Settled;

    msg!(
        "Invoice #{} settled. Profit: {}, Fee: {}, Net return: {}",
        invoice.index,
        profit,
        fee,
        net_return
    );
    Ok(())
}

#[derive(Accounts)]
pub struct SettleInvoice<'info> {
    #[account(
        seeds = [Protocol::SEED],
        bump = protocol.bump,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        mut,
        seeds = [Pool::SEED, pool.index.to_le_bytes().as_ref()],
        bump = pool.bump,
        constraint = pool.key() == invoice.pool,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        address = pool.vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [Invoice::SEED, invoice.index.to_le_bytes().as_ref()],
        bump = invoice.bump,
    )]
    pub invoice: Account<'info, Invoice>,

    /// Treasury receives protocol fees.
    #[account(
        mut,
        constraint = treasury_usdc.mint == pool.usdc_mint,
        constraint = treasury_usdc.owner == protocol.treasury,
    )]
    pub treasury_usdc: Account<'info, TokenAccount>,

    /// Anyone can crank settlement.
    pub settler: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ── Mark Defaulted ─────────────────────────────────────────────────────

/// After maturity + grace period with no repayment, mark invoice defaulted.
///
/// SECURITY: Requires Clock timestamp > maturity + grace_period.
/// This is permissionless (anyone can crank it) but time-gated to prevent
/// premature defaults. Loss is socialized across the pool's LP holders.
pub fn mark_defaulted(ctx: Context<MarkDefaulted>) -> Result<()> {
    let invoice = &ctx.accounts.invoice;
    let protocol = &ctx.accounts.protocol;

    require!(invoice.status == InvoiceStatus::Funded, ObligoError::InvalidInvoiceStatus);

    let clock = Clock::get()?;
    let default_threshold = invoice
        .maturity_timestamp
        .checked_add(protocol.grace_period_seconds)
        .ok_or(ObligoError::MathOverflow)?;

    require!(
        clock.unix_timestamp > default_threshold,
        ObligoError::GracePeriodActive
    );

    // Record loss in pool.
    let pool = &mut ctx.accounts.pool;
    pool.outstanding_funded = pool
        .outstanding_funded
        .checked_sub(invoice.funded_amount)
        .ok_or(ObligoError::MathOverflow)?;
    pool.total_losses = pool
        .total_losses
        .checked_add(invoice.funded_amount)
        .ok_or(ObligoError::MathOverflow)?;

    let invoice = &mut ctx.accounts.invoice;
    invoice.resolved_at = clock.unix_timestamp;
    invoice.status = InvoiceStatus::Defaulted;

    msg!(
        "Invoice #{} DEFAULTED. Loss: {} USDC socialized in pool #{}",
        invoice.index,
        invoice.funded_amount,
        pool.index
    );
    Ok(())
}

#[derive(Accounts)]
pub struct MarkDefaulted<'info> {
    #[account(
        seeds = [Protocol::SEED],
        bump = protocol.bump,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        mut,
        seeds = [Pool::SEED, pool.index.to_le_bytes().as_ref()],
        bump = pool.bump,
        constraint = pool.key() == invoice.pool,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        mut,
        seeds = [Invoice::SEED, invoice.index.to_le_bytes().as_ref()],
        bump = invoice.bump,
    )]
    pub invoice: Account<'info, Invoice>,

    /// Anyone can crank default marking.
    pub cranker: Signer<'info>,
}
