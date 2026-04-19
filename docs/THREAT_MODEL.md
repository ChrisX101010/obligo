# Obligo Protocol — Threat Model & Security Analysis

> This document maps the attack surface of the Obligo invoice-factoring protocol,
> identifies vulnerability classes, and describes the mitigations in place.
> It is structured to facilitate a white-box security audit.

---

## 1. System Trust Assumptions

| Entity | Trust Level | Assumption |
|--------|-------------|------------|
| **Admin** | Trusted | Can pause, set fees, manage verifiers. Cannot steal funds directly. Fee cap at 10% prevents griefing. |
| **Verifier** | Semi-trusted | Co-signs invoice submissions. Assumed honest but could collude with seller. Deregistration does not retroactively invalidate funded invoices. |
| **Pool Manager** | Untrusted | Creates pools and decides which invoices to fund. Cannot withdraw pool funds (only vault PDA can sign). |
| **Lender** | Untrusted | Deposits/withdraws USDC. Cannot influence invoice lifecycle. |
| **Seller** | Untrusted | Submits invoices. Requires verifier attestation. |
| **Debtor** | Untrusted | Repays invoices. Only debtor can call repay_invoice (has_one constraint). |
| **Cranker** | Untrusted | Anyone can call settle_invoice and mark_defaulted. These are permissionless time-gated operations. |

---

## 2. Vulnerability Classes & Analysis

### 2.1 Arithmetic Overflow / Underflow

**Risk**: Integer overflow in LP share calculations, funded amount math, or fee computation could lead to incorrect fund distribution.

**Attack vector**: A carefully crafted deposit amount or invoice face value could overflow `u64` multiplication before division in share price calculations.

**Mitigations**:
- All share math uses `u128` intermediate values (`as u128` before multiplication).
- All arithmetic uses `checked_add`, `checked_sub`, `checked_mul`, `checked_div`.
- Cargo profile `[profile.release]` sets `overflow-checks = true`.
- Face value capped by pool's `max_invoice_size`.

**Residual risk**: LOW. The 128-bit intermediaries handle up to ~3.4×10³⁸, far exceeding any realistic USDC amount (max u64 ≈ 1.8×10¹⁹ lamports = 18 trillion USDC).

### 2.2 First-Depositor / Share Inflation Attack

**Risk**: An attacker deposits 1 lamport as the first depositor, then donates a large amount of USDC directly to the vault, inflating the share price. Subsequent depositors receive 0 shares due to integer division rounding.

**Attack vector**:
1. Attacker deposits 1 USDC lamport → receives 1 LP share (1:1 at genesis).
2. Attacker transfers 1,000,000 USDC directly to the vault (not through deposit).
3. Share price = NAV / total_shares = 1,000,001 / 1 = 1,000,001 per share.
4. Next depositor deposits 999,999 USDC → receives 0 shares (rounds down).

**Mitigations**:
- Pool accounting tracks `total_deposited` and `total_withdrawn` through the program, not by reading vault balance. Direct vault donations do NOT increase NAV.
- NAV is computed from `total_deposited - total_withdrawn - outstanding_funded + total_returns - total_losses`, NOT from `vault.amount`.
- This makes the donation vector ineffective: donated tokens sit in the vault but are not reflected in share price calculations.

**Residual risk**: NEGLIGIBLE. The accounting is input-based, not balance-based.

### 2.3 Oracle / Verifier Collusion

**Risk**: A compromised verifier could attest fake invoices, allowing a colluding seller to extract pool funds.

**Attack vector**:
1. Seller creates a fictitious invoice for $50,000.
2. Compromised verifier co-signs the submission.
3. Pool manager (who may also be the attacker) funds the invoice.
4. "Debtor" never repays. After grace period, loss is socialized.
5. Seller walks away with $47,500 (funded amount at 5% discount).

**Mitigations**:
- Verifier registration is admin-only, limiting the verifier set.
- `submit_invoice` requires the verifier to actively sign (not just reference an old attestation).
- Deregistration via `deregister_verifier` immediately prevents new attestations.
- Pool managers have discretion over which invoices to fund; prudent managers would verify invoice legitimacy off-chain before funding.
- Pools have `max_invoice_size` limits to cap single-invoice exposure.
- On-chain attestation count per verifier provides auditability.

**Residual risk**: MEDIUM. This is inherently a trust boundary. The protocol makes the verifier's behavior transparent and auditable, but cannot prevent off-chain collusion. Future enhancement: multi-verifier threshold signatures, on-chain reputation scoring.

### 2.4 Pool Manager Front-Running / Self-Dealing

**Risk**: Pool manager creates invoices, verifies them (if also a verifier), and funds them from their own pool to extract lender capital.

**Attack vector**:
1. Manager also registers as verifier.
2. Manager creates fake invoice, self-attests, self-funds.
3. "Debtor" never pays → loss socialized across LP holders.

**Mitigations**:
- Verifier registration is admin-only; pool managers cannot self-register as verifiers.
- Admin should maintain separation of roles (verifier ≠ manager ≠ seller).
- Pool-level risk parameters limit maximum per-invoice exposure.
- LP holders can monitor on-chain activity and withdraw if a pool manager acts suspiciously.

**Residual risk**: MEDIUM. Depends on admin governance. Future: DAO-controlled verifier registry, mandatory cooling periods between invoice submission and funding.

### 2.5 Premature Default / Default Front-Running

**Risk**: An attacker calls `mark_defaulted` before the debtor has a reasonable chance to repay, causing unnecessary losses.

**Attack vector**: If the grace period is too short or the clock can be manipulated.

**Mitigations**:
- `mark_defaulted` requires `Clock::unix_timestamp > maturity + grace_period`.
- Grace period is set at protocol level and must be > 0 (enforced in `initialize_protocol`).
- Solana's `Clock` sysvar is controlled by the validator and cannot be manipulated by users.
- Default is permissionless but time-gated; no signer advantage.

**Residual risk**: LOW. The time gate is reliable on Solana.

### 2.6 Re-entrancy via Status Machine

**Risk**: An instruction completes partially, then a cross-program invocation re-enters the protocol in an inconsistent state.

**Mitigations**:
- Obligo does not make CPI calls to untrusted programs. All CPIs are to the SPL Token program.
- Invoice status transitions are one-directional and checked at the start of each handler:
  - `Submitted → Funded` (only `fund_invoice`)
  - `Funded → Repaid` (only `repay_invoice`)
  - `Repaid → Settled` (only `settle_invoice`)
  - `Funded → Defaulted` (only `mark_defaulted`)
- State is updated AFTER validation but BEFORE external effects where possible (checks-effects-interactions pattern adapted for Solana).

**Residual risk**: NEGLIGIBLE. Solana's runtime prevents same-transaction re-entrancy to the same program, and all CPIs target the trusted SPL Token program.

### 2.7 PDA Seed Collision

**Risk**: Two different accounts could derive to the same PDA, overwriting data.

**Mitigations**:
- Each account type uses a unique prefix seed:
  - Protocol: `["protocol"]` (singleton)
  - Verifier: `["verifier", authority_pubkey]`
  - Pool: `["pool", pool_index_le_bytes]`
  - Invoice: `["invoice", invoice_index_le_bytes]`
  - Position: `["position", pool_pubkey, lender_pubkey]`
- Indices are sequential counters that never repeat (monotonic, checked_add).
- All `init` constraints ensure the account doesn't already exist.

**Residual risk**: NEGLIGIBLE.

### 2.8 Unauthorized Fund Access

**Risk**: An attacker crafts a transaction that transfers tokens from a pool vault without authorization.

**Mitigations**:
- Pool vault's authority is the Pool PDA itself.
- Only instructions that sign with the pool's PDA seeds can transfer from the vault.
- PDA seeds include `Pool::SEED` + `pool.index.to_le_bytes()` + `[bump]`.
- The `address = pool.vault` constraint ensures the correct vault is used.
- Withdraw validates `position.lender == signer`.
- Fund_invoice validates `pool.manager == signer`.

**Residual risk**: LOW.

### 2.9 Stale / Incorrect NAV Calculation

**Risk**: If NAV doesn't accurately reflect pool state, share price could be wrong, enabling either depositors or withdrawers to extract value.

**Analysis**: NAV = `total_deposited - total_withdrawn - outstanding_funded + total_returns - total_losses`.

Each component is updated atomically in the same instruction that causes the change:
- `deposit`: increments `total_deposited`
- `withdraw`: increments `total_withdrawn`
- `fund_invoice`: increments `outstanding_funded`
- `settle_invoice`: decrements `outstanding_funded`, increments `total_returns`
- `mark_defaulted`: decrements `outstanding_funded`, increments `total_losses`

**Mitigations**:
- No external reads (e.g., vault balance) are used in NAV; it's purely accounting-based.
- All updates are in the same transaction as the corresponding token transfer.
- `saturating_sub` is used defensively, though values should never underflow if accounting is correct.

**Residual risk**: LOW. An auditor should verify that no code path updates one accounting field without the corresponding counterpart.

### 2.10 Withdrawal During Active Invoices

**Risk**: A lender withdraws all liquidity while invoices are outstanding, leaving the pool unable to absorb returns.

**Mitigations**:
- `available_liquidity()` subtracts `outstanding_funded` from the withdrawable balance.
- Withdrawal is capped at available liquidity: `require!(usdc_out <= pool.available_liquidity())`.
- This ensures capital backing outstanding invoices remains locked.

**Residual risk**: LOW.

---

## 3. Privilege Escalation Matrix

| Action | Required Signer(s) | PDA Constraint |
|--------|-------------------|----------------|
| Initialize protocol | Admin | Seeds: `["protocol"]` |
| Update protocol | Admin | `has_one = admin` |
| Pause / Unpause | Admin | `has_one = admin` |
| Register verifier | Admin | Seeds: `["verifier", authority]` |
| Create pool | Anyone (pays rent) | Seeds: `["pool", index]` |
| Deposit | Lender | Seeds: `["position", pool, lender]` |
| Withdraw | Lender (position owner) | `has_one = lender` |
| Submit invoice | Seller + Verifier | Verifier: `active == true`, co-signer |
| Fund invoice | Pool Manager | `has_one = manager` |
| Repay invoice | Debtor | `has_one = debtor` |
| Settle invoice | Anyone (permissionless) | Status: `Repaid` |
| Mark defaulted | Anyone (permissionless) | Status: `Funded`, time gate |

---

## 4. Economic Attack Vectors

### 4.1 Invoice Cycling Attack
**Scenario**: Seller submits → gets funded → debtor repays immediately → repeat. Each cycle extracts the discount as "profit" for the pool, but if the seller and debtor are the same entity, they're paying the discount to launder the apparent APY of the pool.

**Impact**: Misleading APY attracts more lenders, who then bear real default risk on genuine invoices.

**Mitigation**: Pool managers should enforce minimum time-to-maturity. The protocol enforces `maturity_timestamp > now`. Additional mitigation: cooldown between funding and new submission from the same seller.

### 4.2 Dust Deposit Griefing
**Scenario**: Attacker deposits 1 lamport repeatedly, creating many Position accounts that cost rent but provide negligible value.

**Impact**: Storage bloat; each Position costs ~160 bytes × rent-exempt minimum.

**Mitigation**: The `init_if_needed` pattern means repeat deposits from the same lender to the same pool reuse the existing Position. Cross-pool dust requires separate pool PDAs, making the attack expensive (each pool creation costs rent for the Pool and Vault accounts).

---

## 5. Known Limitations & Future Work

1. **Single-token pools**: Currently only USDC. Multi-collateral pools would require oracle price feeds.
2. **No partial repayment**: Debtor must repay full face value. Partial repayment support would add complexity to settlement math.
3. **No secondary market**: LP shares cannot be transferred between wallets. A transferable LP token (SPL Mint) would enable secondary liquidity.
4. **Verifier centralization**: Admin controls the verifier set. A DAO governance module would decentralize this.
5. **No insurance fund**: Defaults are fully socialized within the pool. A protocol-level insurance fund would reduce per-pool loss severity.
6. **Clock dependency**: Maturity and grace period rely on `Clock::unix_timestamp`, which has ~1-2 second precision. This is acceptable for day-scale maturities.

---

## 6. Audit Readiness Checklist

- [x] All arithmetic uses checked operations or 128-bit intermediaries
- [x] All PDA seeds are unique per account type with no collision risk
- [x] All signer constraints validated at the account struct level
- [x] Status transitions are one-directional and checked before mutation
- [x] Token transfers use CPI to SPL Token program only
- [x] NAV accounting is input-based, not balance-based
- [x] Fee is capped at 10% to prevent admin griefing
- [x] Emergency pause mechanism exists
- [x] Grace period prevents premature defaults
- [x] Withdrawal is capped at available (non-outstanding) liquidity
- [x] Program builds with `overflow-checks = true`

---

*Prepared for Adevar Labs security review as part of the Solana Frontier Hackathon 2026.*
