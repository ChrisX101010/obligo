use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod utils;

use instructions::*;

declare_id!("ob1ig0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

#[program]
pub mod obligo {
    use super::*;

    // ── Admin ──────────────────────────────────────────────────────────
    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        fee_bps: u16,
        grace_period_seconds: i64,
    ) -> Result<()> {
        instructions::admin::initialize_protocol(ctx, fee_bps, grace_period_seconds)
    }

    pub fn update_protocol(
        ctx: Context<UpdateProtocol>,
        new_fee_bps: Option<u16>,
        new_grace_period: Option<i64>,
    ) -> Result<()> {
        instructions::admin::update_protocol(ctx, new_fee_bps, new_grace_period)
    }

    pub fn pause_protocol(ctx: Context<PauseProtocol>) -> Result<()> {
        instructions::admin::pause_protocol(ctx)
    }

    pub fn unpause_protocol(ctx: Context<UnpauseProtocol>) -> Result<()> {
        instructions::admin::unpause_protocol(ctx)
    }

    // ── Verifier Registry ──────────────────────────────────────────────
    pub fn register_verifier(ctx: Context<RegisterVerifier>) -> Result<()> {
        instructions::verifier::register_verifier(ctx)
    }

    pub fn deregister_verifier(ctx: Context<DeregisterVerifier>) -> Result<()> {
        instructions::verifier::deregister_verifier(ctx)
    }

    // ── Pool Management ────────────────────────────────────────────────
    pub fn create_pool(
        ctx: Context<CreatePool>,
        pool_name: String,
        max_invoice_size: u64,
        min_discount_bps: u16,
        max_maturity_seconds: i64,
    ) -> Result<()> {
        instructions::pool::create_pool(
            ctx,
            pool_name,
            max_invoice_size,
            min_discount_bps,
            max_maturity_seconds,
        )
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::pool::deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, lp_amount: u64) -> Result<()> {
        instructions::pool::withdraw(ctx, lp_amount)
    }

    // ── Invoice Lifecycle ──────────────────────────────────────────────
    pub fn submit_invoice(
        ctx: Context<SubmitInvoice>,
        face_value: u64,
        maturity_timestamp: i64,
        debtor: Pubkey,
        invoice_id: String,
        ipfs_hash: String,
    ) -> Result<()> {
        instructions::invoice::submit_invoice(
            ctx,
            face_value,
            maturity_timestamp,
            debtor,
            invoice_id,
            ipfs_hash,
        )
    }

    pub fn fund_invoice(ctx: Context<FundInvoice>, discount_bps: u16) -> Result<()> {
        instructions::invoice::fund_invoice(ctx, discount_bps)
    }

    pub fn repay_invoice(ctx: Context<RepayInvoice>) -> Result<()> {
        instructions::invoice::repay_invoice(ctx)
    }

    pub fn settle_invoice(ctx: Context<SettleInvoice>) -> Result<()> {
        instructions::invoice::settle_invoice(ctx)
    }

    pub fn mark_defaulted(ctx: Context<MarkDefaulted>) -> Result<()> {
        instructions::invoice::mark_defaulted(ctx)
    }
}
