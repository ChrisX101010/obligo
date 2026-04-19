# Obligo Protocol — Architecture & Design Decisions

## Overview

Obligo implements programmable invoice factoring on Solana using the Anchor framework. This document explains the key design decisions and tradeoffs.

## Design Principles

1. **Isolation over composability**: Each pool is fully independent. A default in Pool A does not affect Pool B. This sacrifices capital efficiency for safety.

2. **Input-based accounting over balance-based**: Pool NAV is computed from cumulative input/output counters, not by reading the vault token balance. This prevents donation attacks and ensures accounting consistency.

3. **Permissionless cranking**: Settlement and default marking are permissionless operations gated only by time and status. This eliminates single-point-of-failure reliance on any party to complete the lifecycle.

4. **Co-signature verification**: Invoice submission requires an active verifier to co-sign the transaction. This is stronger than off-chain signature verification because the verifier must actively participate in the on-chain transaction.

## Account Model

### Protocol (Singleton)
- Seeds: `["protocol"]`
- One per deployment. Stores admin, fee rate, grace period, and global counters.
- The sequential counters (`pool_count`, `invoice_count`) are used as PDA seeds for pools and invoices, guaranteeing uniqueness.

### Verifier (Per oracle)
- Seeds: `["verifier", authority_pubkey]`
- Soft-delete model: `deregister_verifier` sets `active = false` rather than closing the account. This preserves the attestation audit trail.

### Pool (Per pool)
- Seeds: `["pool", index_le_bytes]`
- Each pool owns a token vault (standard SPL TokenAccount with pool PDA as authority).
- Risk parameters are immutable after creation: `max_invoice_size`, `min_discount_bps`, `max_maturity_seconds`. This prevents a manager from weakening risk params after attracting deposits.

### Invoice (Per invoice)
- Seeds: `["invoice", index_le_bytes]`
- Immutable fields after creation: `face_value`, `seller`, `debtor`, `maturity_timestamp`, `verifier`, `invoice_id`, `ipfs_hash`.
- Mutable fields set during lifecycle: `pool`, `funded_amount`, `discount_bps`, `funded_at`, `repaid_at`, `resolved_at`, `status`.

### Position (Per lender-pool pair)
- Seeds: `["position", pool_pubkey, lender_pubkey]`
- Uses `init_if_needed` so repeated deposits from the same lender to the same pool accumulate in one account.

## LP Share Math

The LP share model follows the standard vault share pattern:

```
shares_for_deposit = amount * total_shares / NAV
value_of_shares   = shares * NAV / total_shares
```

At genesis (no shares exist), deposits mint shares 1:1 with the USDC amount. This is safe because NAV = 0 when total_shares = 0.

NAV = total_deposited - total_withdrawn - outstanding_funded + total_returns - total_losses

This formula ensures:
- Deposits increase NAV
- Withdrawals decrease NAV
- Funding locks capital (reduces available, but outstanding is part of NAV)
- Settlement returns capital + profit (increases NAV beyond funded amount)
- Defaults reduce NAV by the funded amount

## Fee Model

Protocol fee is charged on **profit**, not on principal. Profit = face_value - funded_amount.

```
fee = profit * fee_bps / 10000
```

This aligns incentives: the protocol earns more when pools are profitable.

## Settlement Flow

```
1. submit_invoice (seller + verifier)
   └─ Creates Invoice account with status = Submitted

2. fund_invoice (pool manager)
   ├─ Validates risk parameters
   ├─ Transfers funded_amount from vault → seller
   ├─ Sets status = Funded
   └─ Increments pool.outstanding_funded

3a. repay_invoice (debtor)
    ├─ Transfers face_value from debtor → vault
    └─ Sets status = Repaid

3b. [if no repayment after maturity + grace_period]
    mark_defaulted (anyone)
    ├─ Decrements pool.outstanding_funded
    ├─ Increments pool.total_losses
    └─ Sets status = Defaulted

4. settle_invoice (anyone, after repayment)
   ├─ Calculates fee on profit
   ├─ Transfers fee from vault → treasury
   ├─ Decrements pool.outstanding_funded
   ├─ Increments pool.total_returns by net_return
   └─ Sets status = Settled
```

## Why Anchor 0.31?

- `InitSpace` derive macro for automatic space calculation
- `init_if_needed` for Position accounts (reduces tx count for repeat depositors)
- Mature constraint system (`has_one`, `seeds`, `bump`, `address`)
- IDL generation for TypeScript client

## Tradeoffs Acknowledged

| Decision | Benefit | Cost |
|----------|---------|------|
| Pool isolation | No cross-pool contagion | Lower capital efficiency |
| Input-based accounting | Donation attack proof | Accounting and vault can drift if direct transfers occur |
| Immutable risk params | Prevents bait-and-switch | Manager can't adjust to market conditions |
| Full repayment only | Simple settlement math | Less flexible for debtors |
| Single verifier per invoice | Simple co-signing | Single point of trust |

## Future Architecture

- **Multi-verifier threshold**: Require M-of-N verifier signatures per invoice
- **Transferable LP**: Mint SPL tokens representing pool shares for secondary market
- **Partial repayment**: Allow debtors to repay in installments
- **Oracle price feeds**: Enable non-USDC pools with proper pricing
- **Governance module**: DAO-controlled verifier registry and protocol parameters
