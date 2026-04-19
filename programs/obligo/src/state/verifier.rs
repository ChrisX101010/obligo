use anchor_lang::prelude::*;

/// Verifier attestation record. PDA seeded ["verifier", verifier_pubkey].
///
/// SECURITY INVARIANTS:
/// - Only protocol admin can register/deregister verifiers.
/// - A verifier must co-sign `submit_invoice` to attest the invoice is real.
/// - Deregistered verifiers cannot attest new invoices, but previously
///   attested invoices remain valid (no retroactive invalidation).
#[account]
#[derive(InitSpace)]
pub struct Verifier {
    /// The public key of the trusted verifier/oracle.
    pub authority: Pubkey,
    /// Whether this verifier is currently active.
    pub active: bool,
    /// Timestamp of registration.
    pub registered_at: i64,
    /// Number of invoices this verifier has attested.
    pub attestation_count: u64,
    /// Bump seed for this PDA.
    pub bump: u8,
}

impl Verifier {
    pub const SEED: &'static [u8] = b"verifier";
}
