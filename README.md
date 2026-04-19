# Obligo — Programmable Invoice-Factoring Protocol for Solana

> **Solana Frontier Hackathon 2026 — Adevar Labs Security Audit Track**

Obligo is a decentralized invoice-factoring protocol that enables small businesses to tokenize verified invoices as on-chain assets, fund them through programmable lending pools at a discount, and settle automatically when the debtor pays.

## Why Invoice Factoring On-Chain?

Invoice factoring is a $3.8 trillion global market dominated by opaque intermediaries who charge 2-5% fees with multi-week settlement times. Obligo brings this market on-chain with:

- **Instant settlement**: Repayment → settlement in a single block
- **Transparent risk**: All pool accounting, discount rates, and default history visible on-chain
- **Programmable risk parameters**: Each pool defines its own max invoice size, min discount, max maturity
- **Permissionless pools**: Anyone can create a lending pool with custom risk appetite
- **Oracle-verified invoices**: Verifier co-signatures prevent fraudulent invoice submission

## Architecture

```
┌─────────────┐      ┌──────────────┐     ┌─────────────┐
│   Seller    │      │   Verifier   │     │   Debtor    │
│  (invoice   │      │  (oracle,    │     │  (pays face │
│   owner)    │      │   co-signs)  │     │   value)    │
└──────┬──────┘      └──────┬───────┘     └──────┬──────┘
       │                    │                    │
       │  submit_invoice    │ co-sign            │ repay_invoice
       │  ──────────────────┤                    │
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                    OBLIGO PROGRAM                        │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Protocol │  │ Verifier │  │ Invoice  │  │  Pool  │ │
│  │ (global  │  │ Registry │  │ (token-  │  │ (vault │ │
│  │  config) │  │          │  │  ized)   │  │  + LP) │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│                                                         │
│  ┌──────────┐  ┌──────────────────────────────────────┐ │
│  │ Position │  │  Settlement Engine                   │ │
│  │ (lender  │  │  • fund_invoice (pool → seller)      │ │
│  │  LP)     │  │  • repay_invoice (debtor → vault)    │ │
│  └──────────┘  │  • settle_invoice (fee + return)     │ │
│                │  • mark_defaulted (loss socialization)│ │
│                └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
       ▲                                         ▲
       │  deposit / withdraw                     │
       │                                         │
┌──────┴──────┐                          ┌───────┴──────┐
│   Lender    │                          │  Pool Mgr    │
│  (provides  │                          │  (funds      │
│   USDC)     │                          │   invoices)  │
└─────────────┘                          └──────────────┘
```

## Quick Start

### Prerequisites
- Rust 1.75+
- Solana CLI 2.1+
- Anchor CLI 0.31+
- Node.js 18+

### Build & Test
```bash
# Clone and enter
cd obligo

# Install JS deps
npm install

# Build the program
anchor build

# Run tests (requires solana-test-validator)
anchor test

# Frontend
cd app && npm install && npm run dev
```

### Deploy to Devnet
```bash
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

## Program Instructions

| Instruction | Auth | Description |
|---|---|---|
| `initialize_protocol` | Admin | Set fee rate, grace period, treasury |
| `update_protocol` | Admin | Modify fee or grace period |
| `pause_protocol` | Admin | Emergency pause all operations |
| `unpause_protocol` | Admin | Resume operations |
| `register_verifier` | Admin | Add trusted oracle verifier |
| `deregister_verifier` | Admin | Remove verifier (soft delete) |
| `create_pool` | Anyone | Create lending pool with risk params |
| `deposit` | Lender | Add USDC, receive LP shares |
| `withdraw` | Lender | Burn LP shares, receive USDC |
| `submit_invoice` | Seller + Verifier | Tokenize invoice (verifier co-signs) |
| `fund_invoice` | Pool Manager | Purchase invoice at discount |
| `repay_invoice` | Debtor | Pay full face value |
| `settle_invoice` | Anyone (crank) | Distribute returns + fees |
| `mark_defaulted` | Anyone (crank) | After grace period, record loss |

## Security Design

See [THREAT_MODEL.md](docs/THREAT_MODEL.md) for a comprehensive security analysis. Key highlights:

- **Verifier co-signature**: Prevents fraudulent invoice submission
- **Checked arithmetic**: All math uses `checked_*` or 128-bit intermediaries
- **PDA seeds**: All accounts derived deterministically, no seed collisions possible
- **Status machine**: One-directional state transitions prevent re-entrancy
- **Time-gated defaults**: Grace period prevents premature default front-running
- **Pool isolation**: Each pool has independent accounting; no cross-pool contagion
- **Fee caps**: Protocol fee capped at 10% to prevent admin griefing

## Project Structure

```
obligo/
├── programs/obligo/src/
│   ├── lib.rs                 # Entry point
│   ├── state/                 # Account definitions
│   │   ├── protocol.rs        # Global config
│   │   ├── verifier.rs        # Oracle registry
│   │   ├── pool.rs            # Lending pool + LP math
│   │   ├── invoice.rs         # Tokenized invoice
│   │   └── position.rs        # Lender position
│   ├── instructions/          # Instruction handlers
│   │   ├── admin.rs           # Init, update, pause
│   │   ├── verifier.rs        # Register/deregister
│   │   ├── pool.rs            # Create, deposit, withdraw
│   │   └── invoice.rs         # Submit, fund, repay, settle, default
│   └── utils/
│       └── mod.rs             # Error codes
├── tests/
│   └── obligo.ts              # Integration tests
├── app/                       # Next.js frontend
├── docs/
│   ├── THREAT_MODEL.md        # Security analysis
│   └── ARCHITECTURE.md        # Design decisions
└── Anchor.toml
```

## License

MIT

## Acknowledgments

Built for the Solana Frontier Hackathon 2026, Adevar Labs Security Audit Track.
