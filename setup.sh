#!/bin/bash
# setup.sh — Quick start for Obligo on WSL/Linux
# Usage: chmod +x setup.sh && ./setup.sh

set -e

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  OBLIGO — Programmable Invoice Factoring      ║"
echo "║  Solana Frontier Hackathon 2026               ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
echo ""

check_cmd() {
    if command -v "$1" &> /dev/null; then
        VERSION=$($1 --version 2>&1 | head -1)
        echo "  ✓ $1: $VERSION"
        return 0
    else
        echo "  ✗ $1: NOT FOUND"
        return 1
    fi
}

MISSING=0
check_cmd "rustc" || MISSING=1
check_cmd "cargo" || MISSING=1
check_cmd "solana" || MISSING=1
check_cmd "anchor" || MISSING=1
check_cmd "node" || MISSING=1
check_cmd "npm" || MISSING=1

echo ""

if [ "$MISSING" -eq 1 ]; then
    echo "Some tools are missing. Install them:"
    echo ""
    echo "  Rust:       curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo "  Solana CLI: sh -c \"\$(curl -sSfL https://release.anza.xyz/stable/install)\""
    echo "  Anchor:     cargo install --git https://github.com/coral-xyz/anchor avm --force"
    echo "              avm install latest && avm use latest"
    echo "  Node.js:    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "              sudo apt-get install -y nodejs"
    echo ""
    echo "After installing, re-run this script."
    exit 1
fi

# Install JS dependencies
echo "Installing JavaScript dependencies..."
npm install
echo ""

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd app && npm install && cd ..
echo ""

# Configure Solana for localnet
echo "Configuring Solana for localnet..."
solana config set --url localhost
solana-keygen new --no-bip39-passphrase --silent --force -o ~/.config/solana/id.json 2>/dev/null || true
echo ""

# Build
echo "Building Anchor program..."
anchor build
echo ""

# Show next steps
PROGRAM_ID=$(solana-keygen pubkey target/deploy/obligo-keypair.json 2>/dev/null || echo "unknown")

echo "╔═══════════════════════════════════════════════╗"
echo "║  ✓ Setup Complete!                            ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "  Program ID: $PROGRAM_ID"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Run tests:"
echo "     anchor test"
echo ""
echo "  2. Deploy to devnet:"
echo "     ./scripts/deploy.sh"
echo ""
echo "  3. Start frontend:"
echo "     cd app && npm run dev"
echo ""
echo "  4. Read the docs:"
echo "     docs/THREAT_MODEL.md   — Security analysis"
echo "     docs/ARCHITECTURE.md   — Design decisions"
echo "     docs/SUBMISSION.md     — Bounty submission"
echo ""
