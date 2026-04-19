use anchor_lang::prelude::*;
use crate::state::Protocol;
use crate::utils::ObligoError;

/// Initialize the protocol singleton. Can only be called once.
pub fn initialize_protocol(
    ctx: Context<InitializeProtocol>,
    fee_bps: u16,
    grace_period_seconds: i64,
) -> Result<()> {
    require!(fee_bps <= Protocol::MAX_FEE_BPS, ObligoError::FeeTooHigh);
    require!(grace_period_seconds > 0, ObligoError::InvalidGracePeriod);

    let protocol = &mut ctx.accounts.protocol;
    protocol.admin = ctx.accounts.admin.key();
    protocol.treasury = ctx.accounts.treasury.key();
    protocol.fee_bps = fee_bps;
    protocol.grace_period_seconds = grace_period_seconds;
    protocol.paused = false;
    protocol.pool_count = 0;
    protocol.invoice_count = 0;
    protocol.bump = ctx.bumps.protocol;

    msg!("Protocol initialized. Fee: {} bps, Grace: {}s", fee_bps, grace_period_seconds);
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Protocol::INIT_SPACE,
        seeds = [Protocol::SEED],
        bump,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Treasury wallet, validated by admin at init time.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Update protocol parameters.
pub fn update_protocol(
    ctx: Context<UpdateProtocol>,
    new_fee_bps: Option<u16>,
    new_grace_period: Option<i64>,
) -> Result<()> {
    let protocol = &mut ctx.accounts.protocol;

    if let Some(fee) = new_fee_bps {
        require!(fee <= Protocol::MAX_FEE_BPS, ObligoError::FeeTooHigh);
        protocol.fee_bps = fee;
    }

    if let Some(gp) = new_grace_period {
        require!(gp > 0, ObligoError::InvalidGracePeriod);
        protocol.grace_period_seconds = gp;
    }

    msg!("Protocol updated");
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateProtocol<'info> {
    #[account(
        mut,
        seeds = [Protocol::SEED],
        bump = protocol.bump,
        has_one = admin,
    )]
    pub protocol: Account<'info, Protocol>,

    pub admin: Signer<'info>,
}

/// Emergency pause.
pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
    ctx.accounts.protocol.paused = true;
    msg!("Protocol PAUSED");
    Ok(())
}

#[derive(Accounts)]
pub struct PauseProtocol<'info> {
    #[account(
        mut,
        seeds = [Protocol::SEED],
        bump = protocol.bump,
        has_one = admin,
    )]
    pub protocol: Account<'info, Protocol>,

    pub admin: Signer<'info>,
}

/// Resume from pause.
pub fn unpause_protocol(ctx: Context<UnpauseProtocol>) -> Result<()> {
    ctx.accounts.protocol.paused = false;
    msg!("Protocol UNPAUSED");
    Ok(())
}

#[derive(Accounts)]
pub struct UnpauseProtocol<'info> {
    #[account(
        mut,
        seeds = [Protocol::SEED],
        bump = protocol.bump,
        has_one = admin,
    )]
    pub protocol: Account<'info, Protocol>,

    pub admin: Signer<'info>,
}
