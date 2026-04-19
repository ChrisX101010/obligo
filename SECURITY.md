# Obligo — Security Notes

This document summarizes the security posture of the Obligo on-chain program
for external auditors. It covers (1) known findings that have been fixed,
(2) design decisions that are intentional trust assumptions rather than bugs,
and (3) areas that warrant particular attention during audit.

## 1. Findings addressed in this commit

### Critical

**C1 — Inflation ("donation") attack on first LP deposit.**
Previously `shares_for_deposit` minted shares 1:1 with the first depositor's
amount. This enabled the classic ERC-4626-style inflation attack: attacker
deposits 1 lamport (1 share), donates a large balance directly to the vault,
and subsequent depositors' shares round to zero.

*Fix:* On the first deposit, `Pool::MIN_LIQUIDITY` (1000 share units) are
minted as "dead shares" credited to the pool's own total but never assigned
to any position and never redeemable. See `state/pool.rs::shares_for_deposit`.
First deposits must exceed `MIN_LIQUIDITY` or they revert with
`FirstDepositTooSmall`.

**C2 — CPI before state update (check-effects-interactions violation).**
`deposit`, `withdraw`, `fund_invoice`, `repay_invoice`, and `settle_invoice`
previously mutated state *after* their SPL token CPI. Although Solana's
runtime does not permit re-entrancy into the same program the way EVM does,
the pattern is defense-in-depth against malicious token program variants
(e.g. hook-capable token-2022 mints) and makes formal reasoning simpler.

*Fix:* All instructions now update invoice/pool/position state before
invoking `token::transfer`.

### High

**H1 — Missing invoice-pool cross-check in `repay_invoice`.**
The `RepayInvoice` accounts struct accepted any pool whose index-derived PDA
was valid, with no constraint tying it to `invoice.pool`. A malicious frontend
could trick a debtor into repaying a *different* pool's vault, poisoning
accounting across two pools.

*Fix:* Added `constraint = pool.key() == invoice.pool @ InvoicePoolMismatch`.
The same named error is now used on `SettleInvoice` and `MarkDefaulted` for
consistency.

### Medium

**M1 — Silent saturating arithmetic in `nav()` / `available_liquidity()`.**
These helpers used `saturating_add`/`saturating_sub`, which would mask an
impossible accounting state (e.g. losses > deposits) rather than failing.

*Fix:* Added `nav_checked()` and `available_liquidity_checked()` that return
`Result<u64>` using checked arithmetic. All on-chain decisions (liquidity
gates, share pricing, withdrawal sizing) now use the checked variants; the
saturating versions are retained only for display/logging purposes.

**M2 — Dust invoices could produce `funded_amount == 0`.**
`(face_value × (10000 - discount_bps)) / 10000` rounds down. For face values
of a few lamports with small discounts, the pool could emit a zero-transfer
funding event that still moved the invoice to `Funded`.

*Fix:* Added `require!(funded_amount > 0, ZeroFundedAmount)` in `fund_invoice`.

**M3 — Unbounded `face_value` on `submit_invoice`.**
An attacker could submit invoices with `face_value = u64::MAX`, polluting the
registry. Spam is rent-bounded (the seller pays rent for the invoice PDA),
but nonsensically large values are now rejected.

*Fix:* Capped at 10,000,000,000,000 lamports ($10M USDC assuming 6 decimals)
with `FaceValueTooLarge`.

### Low

**L1 — `.unwrap()` on checked arithmetic in state helpers.**
`share_price`, `shares_for_deposit`, `value_of_shares` previously unwrapped
`checked_mul`/`checked_div`, which would panic rather than return an Anchor
error. Panics consume the entire compute budget and emit an unhelpful
`ProgramFailedToComplete`.

*Fix:* All helpers now return `Result<u64>` and propagate `MathOverflow`.

## 2. Intentional trust assumptions (not bugs)

These are documented here so auditors and users understand the trust model:

**T1 — Pool managers can refuse to fund specific invoices.**
`fund_invoice` requires `has_one = manager` on the pool. This means a pool
manager unilaterally chooses which submitted invoices to fund. In a factoring
protocol this is expected (it is the manager's risk underwriting), but it
does mean:
- Managers can front-run profitable invoices into their own pools.
- Managers can discriminate among sellers for reasons outside the protocol.
- There is no forced-fund or queue mechanism.

LPs must trust the managers of the pools they deposit into. A future
version may add a permissionless auction layer to address this.

**T2 — Pool managers can fund invoices where they are the seller.**
The protocol does not prevent self-dealing. A manager who also submits
invoices (via a separate verifier) could fund themselves at favorable
discounts. This is mitigated by the verifier requirement (a collusion
is needed with an active verifier) but not eliminated. LPs should verify
the separation of roles off-chain before depositing.

**T3 — Verifier deregistration does not retroactively invalidate.**
Previously-attested invoices remain valid even after the verifier is
deregistered. This is intentional: rewriting history would break invoices
mid-lifecycle. Deregistration blocks *new* attestations only.

**T4 — Protocol admin has broad powers.**
The admin can pause the protocol, change the fee (capped at 10% / 1000 bps),
adjust the grace period, and register/deregister verifiers. The admin cannot:
- Access pool vaults directly.
- Change individual invoice data.
- Change `treasury` after init.
- Recover stuck funds from a pool.

The last bullet is by design — no admin escape hatch — but it means
if `treasury` is set to an unspendable pubkey at `initialize_protocol`,
protocol fees will accrue there permanently. Callers must verify the
treasury pubkey at initialization.

**T5 — Defaults socialize losses across all LPs in the pool.**
`mark_defaulted` increments `pool.total_losses`, which reduces `nav()`
proportionally for all LP share holders. There is no per-invoice insurance,
no tranching, and no recourse against the debtor beyond marking default.
Junior/senior tranches are a roadmap item.

## 3. Areas warranting auditor focus

**F1 — `init_if_needed` on Position PDAs.**
`Deposit` uses `init_if_needed` with seeds `[b"position", pool, lender]`.
Since the seed combination is unique per (pool, lender) and the instruction
checks `position.opened_at == 0` before treating it as first-open, this is
believed safe. Anchor's `init_if_needed` is behind a feature flag because
misuse can enable reinit attacks; we believe our usage is correct but
confirmation would be welcome.

**F2 — LP share rounding asymmetry.**
`shares_for_deposit` rounds down (deposit gets fewer shares → favors pool).
`value_of_shares` also rounds down (withdrawal gets less USDC → favors pool).
Combined with MIN_LIQUIDITY dead shares, the pool "earns" tiny amounts on
round-trips. This is considered acceptable (the classic Uniswap-style
defense) but should be checked against adversarial deposit/withdraw loops.

**F3 — Maturity, grace period, and Clock drift.**
All time-gated logic depends on `Clock::get()?.unix_timestamp`. Solana's
clock is validator-attested with some drift (seconds to minutes). The grace
period should be configured wide enough (days, not seconds) to tolerate
this. The admin-set minimum is `> 0` which is too permissive; a hardened
version would enforce e.g. `>= 3600` (one hour) at minimum.

**F4 — Treasury validation.**
`protocol.treasury` is an `UncheckedAccount` at init, stored as a pubkey
only. At settlement time, the `treasury_usdc` ATA is constrained to be
owned by this pubkey. There is no on-chain check that `protocol.treasury`
is a keypair (not a PDA from an unknown program) or that its USDC ATA
exists. In practice the admin will initialize correctly, but a
`set_treasury` instruction with validation could be a future addition.

**F5 — No explicit rent-exempt reclamation for closed invoices.**
Settled and Defaulted invoices remain on-chain indefinitely, consuming
rent that was paid by the seller. A `close_invoice` instruction that
returns rent to the seller after terminal status would be clean but is
not currently implemented.

## 4. Out of scope

- Oracle/verifier economics (who pays verifiers, slashing, etc.).
- Off-chain invoice document verification (what `ipfs_hash` actually points to).
- Front-running by validators on discover/fund order.
- MEV on settlement cranking.

---

Last updated alongside the invoice/pool audit commit.
