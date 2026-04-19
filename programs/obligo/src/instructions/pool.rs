use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Protocol, Pool, Position};
use crate::utils::ObligoError;

// ── Create Pool ────────────────────────────────────────────────────────

pub fn create_pool(
    ctx: Context<CreatePool>,
    pool_name: String,
    max_invoice_size: u64,
    min_discount_bps: u16,
    max_maturity_seconds: i64,
) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, ObligoError::ProtocolPaused);
    require!(pool_name.len() <= 32, ObligoError::PoolNameTooLong);
    require!(
        min_discount_bps > 0 && min_discount_bps <= 5000,
        ObligoError::InvalidMinDiscount
    );
    require!(max_maturity_seconds > 0, ObligoError::InvalidMaxMaturity);

    let protocol = &mut ctx.accounts.protocol;
    let pool = &mut ctx.accounts.pool;
    let clock = Clock::get()?;

    pool.index = protocol.pool_count;
    pool.manager = ctx.accounts.manager.key();
    pool.name = pool_name;
    pool.max_invoice_size = max_invoice_size;
    pool.min_discount_bps = min_discount_bps;
    pool.max_maturity_seconds = max_maturity_seconds;
    pool.total_deposited = 0;
    pool.total_withdrawn = 0;
    pool.outstanding_funded = 0;
    pool.total_lp_shares = 0;
    pool.total_returns = 0;
    pool.total_losses = 0;
    pool.vault = ctx.accounts.vault.key();
    pool.usdc_mint = ctx.accounts.usdc_mint.key();
    pool.invoices_funded = 0;
    pool.created_at = clock.unix_timestamp;
    pool.bump = ctx.bumps.pool;

    protocol.pool_count = protocol
        .pool_count
        .checked_add(1)
        .ok_or(ObligoError::MathOverflow)?;

    msg!("Pool #{} created: {}", pool.index, pool.name);
    Ok(())
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(
        mut,
        seeds = [Protocol::SEED],
        bump = protocol.bump,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        init,
        payer = manager,
        space = 8 + Pool::INIT_SPACE,
        seeds = [Pool::SEED, protocol.pool_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub pool: Account<'info, Pool>,

    /// The pool's USDC vault, owned by the pool PDA.
    #[account(
        init,
        payer = manager,
        token::mint = usdc_mint,
        token::authority = pool,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub manager: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ── Deposit ────────────────────────────────────────────────────────────

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, ObligoError::ProtocolPaused);
    require!(amount > 0, ObligoError::ZeroDeposit);

    let pool = &mut ctx.accounts.pool;

    // Calculate LP shares to mint BEFORE updating state (prevents donation attack).
    let shares = pool.shares_for_deposit(amount);
    require!(shares > 0, ObligoError::ZeroDeposit);

    // Transfer USDC from lender to vault.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.lender_usdc.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.lender.to_account_info(),
            },
        ),
        amount,
    )?;

    // Update pool accounting.
    pool.total_deposited = pool
        .total_deposited
        .checked_add(amount)
        .ok_or(ObligoError::MathOverflow)?;
    pool.total_lp_shares = pool
        .total_lp_shares
        .checked_add(shares)
        .ok_or(ObligoError::MathOverflow)?;

    // Update position.
    let position = &mut ctx.accounts.position;
    if position.opened_at == 0 {
        position.pool = pool.key();
        position.lender = ctx.accounts.lender.key();
        position.opened_at = Clock::get()?.unix_timestamp;
        position.bump = ctx.bumps.position;
    }
    position.lp_shares = position
        .lp_shares
        .checked_add(shares)
        .ok_or(ObligoError::MathOverflow)?;
    position.total_deposited = position
        .total_deposited
        .checked_add(amount)
        .ok_or(ObligoError::MathOverflow)?;

    msg!(
        "Deposited {} USDC → {} LP shares (pool #{})",
        amount,
        shares,
        pool.index
    );
    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [Protocol::SEED],
        bump = protocol.bump,
    )]
    pub protocol: Account<'info, Protocol>,

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
        init_if_needed,
        payer = lender,
        space = 8 + Position::INIT_SPACE,
        seeds = [Position::SEED, pool.key().as_ref(), lender.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        constraint = lender_usdc.mint == pool.usdc_mint,
        constraint = lender_usdc.owner == lender.key(),
    )]
    pub lender_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lender: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ── Withdraw ───────────────────────────────────────────────────────────

pub fn withdraw(ctx: Context<Withdraw>, lp_amount: u64) -> Result<()> {
    require!(!ctx.accounts.protocol.paused, ObligoError::ProtocolPaused);
    require!(lp_amount > 0, ObligoError::ZeroWithdraw);

    let position = &mut ctx.accounts.position;
    require!(position.lp_shares >= lp_amount, ObligoError::InsufficientShares);

    let pool = &mut ctx.accounts.pool;

    // Calculate USDC value of shares.
    let usdc_out = pool.value_of_shares(lp_amount);
    require!(
        usdc_out <= pool.available_liquidity(),
        ObligoError::InsufficientLiquidity
    );

    // Transfer USDC from vault to lender via PDA signer.
    let pool_index_bytes = pool.index.to_le_bytes();
    let seeds: &[&[u8]] = &[Pool::SEED, &pool_index_bytes, &[pool.bump]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.lender_usdc.to_account_info(),
                authority: pool.to_account_info(),
            },
            &[seeds],
        ),
        usdc_out,
    )?;

    // Update pool accounting.
    pool.total_withdrawn = pool
        .total_withdrawn
        .checked_add(usdc_out)
        .ok_or(ObligoError::MathOverflow)?;
    pool.total_lp_shares = pool
        .total_lp_shares
        .checked_sub(lp_amount)
        .ok_or(ObligoError::MathOverflow)?;

    // Update position.
    position.lp_shares = position
        .lp_shares
        .checked_sub(lp_amount)
        .ok_or(ObligoError::MathOverflow)?;
    position.total_withdrawn = position
        .total_withdrawn
        .checked_add(usdc_out)
        .ok_or(ObligoError::MathOverflow)?;

    msg!(
        "Withdrew {} LP shares → {} USDC (pool #{})",
        lp_amount,
        usdc_out,
        pool.index
    );
    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        seeds = [Protocol::SEED],
        bump = protocol.bump,
    )]
    pub protocol: Account<'info, Protocol>,

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
        seeds = [Position::SEED, pool.key().as_ref(), lender.key().as_ref()],
        bump = position.bump,
        has_one = lender,
    )]
    pub position: Account<'info, Position>,

    #[account(
        mut,
        constraint = lender_usdc.mint == pool.usdc_mint,
        constraint = lender_usdc.owner == lender.key(),
    )]
    pub lender_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub lender: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
