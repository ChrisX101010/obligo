use anchor_lang::prelude::*;
use crate::state::{Protocol, Verifier};

/// Register a new verifier oracle.
pub fn register_verifier(ctx: Context<RegisterVerifier>) -> Result<()> {
    let verifier = &mut ctx.accounts.verifier;
    let clock = Clock::get()?;

    verifier.authority = ctx.accounts.verifier_authority.key();
    verifier.active = true;
    verifier.registered_at = clock.unix_timestamp;
    verifier.attestation_count = 0;
    verifier.bump = ctx.bumps.verifier;

    msg!("Verifier registered: {}", verifier.authority);
    Ok(())
}

#[derive(Accounts)]
pub struct RegisterVerifier<'info> {
    #[account(
        seeds = [Protocol::SEED],
        bump = protocol.bump,
        has_one = admin,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        init,
        payer = admin,
        space = 8 + Verifier::INIT_SPACE,
        seeds = [Verifier::SEED, verifier_authority.key().as_ref()],
        bump,
    )]
    pub verifier: Account<'info, Verifier>,

    /// CHECK: The pubkey being registered as a verifier.
    pub verifier_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Deregister a verifier (soft delete — sets active = false).
pub fn deregister_verifier(ctx: Context<DeregisterVerifier>) -> Result<()> {
    ctx.accounts.verifier.active = false;
    msg!("Verifier deregistered: {}", ctx.accounts.verifier.authority);
    Ok(())
}

#[derive(Accounts)]
pub struct DeregisterVerifier<'info> {
    #[account(
        seeds = [Protocol::SEED],
        bump = protocol.bump,
        has_one = admin,
    )]
    pub protocol: Account<'info, Protocol>,

    #[account(
        mut,
        seeds = [Verifier::SEED, verifier.authority.as_ref()],
        bump = verifier.bump,
    )]
    pub verifier: Account<'info, Verifier>,

    pub admin: Signer<'info>,
}
