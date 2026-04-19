#!/bin/bash
# deploy.sh — Build, deploy to devnet, and initialize the Obligo protocol.
# Usage: ./scripts/deploy.sh

set -e

echo "═══════════════════════════════════════════"
echo "  OBLIGO — Deploy to Solana Devnet"
echo "═══════════════════════════════════════════"

# 1. Ensure devnet
echo ""
echo "[1/5] Configuring Solana CLI for devnet..."
solana config set --url devnet
solana config set --commitment confirmed

# 2. Check wallet balance
BALANCE=$(solana balance | awk '{print $1}')
echo "[2/5] Wallet balance: $BALANCE SOL"
if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "  → Requesting airdrop..."
    solana airdrop 2
    sleep 5
fi

# 3. Build
echo "[3/5] Building Anchor program..."
anchor build

# 4. Get program ID from build
PROGRAM_ID=$(solana-keygen pubkey target/deploy/obligo-keypair.json 2>/dev/null || echo "")
if [ -z "$PROGRAM_ID" ]; then
    echo "ERROR: No keypair found. Run 'anchor build' first."
    exit 1
fi
echo "  → Program ID: $PROGRAM_ID"

# Update Anchor.toml and lib.rs with actual program ID
echo "  → Updating program ID in Anchor.toml and lib.rs..."
sed -i "s/ob1ig0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/$PROGRAM_ID/g" Anchor.toml
sed -i "s/ob1ig0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/$PROGRAM_ID/g" programs/obligo/src/lib.rs

# Rebuild with correct ID
anchor build

# 5. Deploy
echo "[4/5] Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo "[5/5] ✓ Deployment complete!"
echo ""
echo "  Program ID: $PROGRAM_ID"
echo "  Network:    devnet"
echo "  Explorer:   https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo ""
echo "Next steps:"
echo "  1. Run 'npx ts-node scripts/initialize.ts' to set up protocol"
echo "  2. Run 'cd app && npm run dev' to start the frontend"
echo ""
