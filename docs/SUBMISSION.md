# Obligo — Submission for Adevar Labs Security Audit Track

## Frontier Hackathon 2026 — Adevar Labs Bounty

---

### What is Obligo?

Obligo is a programmable invoice-factoring protocol for Solana. Small businesses tokenize verified invoices as on-chain assets, lenders fund them through isolated lending pools at a discount, and the protocol handles automated settlement when the debtor pays.

### Why This Matters

Invoice factoring is a $3.8T global market plagued by opaque pricing, slow settlement (2-4 weeks), and high intermediary fees (2-5%). Obligo compresses this to single-block settlement with transparent on-chain accounting, programmable risk parameters per pool, and verifier-attested invoice authenticity.

### Why Adevar Should Audit This

Obligo has a rich, non-trivial security surface that directly maps to Adevar's expertise:

1. **Escrow & Vault Accounting** — Pool vaults hold lender capital, fund invoices, receive repayments, and distribute settlements. NAV is computed from tracked state (not balance reads) to prevent donation attacks. This mirrors the vault accounting Adevar audited in Clend Vaults.

2. **Oracle / Verifier Trust Boundary** — Verifier co-signatures prevent fraudulent invoices, but verifier collusion remains a medium-risk attack vector. Similar to oracle mispricing risks Adevar found in Clend.

3. **LP Share Math** — Share price, deposit-to-share conversion, and share-to-USDC conversion use 128-bit intermediaries. First-depositor inflation is mitigated by input-based (not balance-based) accounting.

4. **Time-Gated State Machine** — Invoice lifecycle (Submitted → Funded → Repaid → Settled / Defaulted) with time-gated default marking. One-directional status transitions prevent re-play attacks.

5. **Fee Computation** — Fees are calculated on profit (not principal), creating edge cases around rounding and minimum discount enforcement.

6. **Pool Isolation** — Independent accounting per pool prevents cross-pool contagion but requires careful verification that all state updates are atomic and consistent.

### Technical Stack

- **Program**: Anchor 0.31, Rust, ~800 lines of program logic
- **Accounts**: 5 account types (Protocol, Verifier, Pool, Invoice, Position)
- **Instructions**: 13 instructions covering admin, verifier, pool, and invoice lifecycle
- **Tests**: TypeScript integration tests covering happy path and security edge cases
- **Frontend**: Next.js demo UI with dashboard, pool explorer, invoice registry, and submission form
- **Docs**: Comprehensive threat model (11 vulnerability classes analyzed), architecture doc

### Audit-Ready Artifacts

- `docs/THREAT_MODEL.md` — Full security analysis with attack vectors, mitigations, and residual risk ratings
- `docs/ARCHITECTURE.md` — Design decisions and tradeoffs
- `programs/obligo/src/` — Annotated Rust source with security invariant comments on every account struct
- `tests/obligo.ts` — Integration tests including negative (security) test cases
- `Cargo.toml` — `overflow-checks = true` in release profile

### What I'd Want From an Adevar Audit

1. Verification of the NAV accounting invariants (input-based vs. balance-based)
2. Fuzzing of the LP share math at extreme values
3. Analysis of the verifier trust boundary and collusion scenarios
4. Validation of the fee calculation rounding behavior
5. Review of PDA seed uniqueness and collision resistance
6. Assessment of the time-gated default mechanism against clock manipulation

### Links

- **GitHub**: [included in submission]
- **Demo**: [included in submission — Next.js frontend]
- **Devnet Program**: [deploy after local testing]

---

*Built solo for the Solana Frontier Hackathon 2026, Adevar Labs Security Audit Track.*
