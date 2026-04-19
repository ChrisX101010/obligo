/**
 * initialize.ts — Post-deploy script to set up the Obligo protocol.
 *
 * Usage: npx ts-node scripts/initialize.ts
 *
 * This script:
 * 1. Initializes the Protocol singleton with fee and grace period
 * 2. Registers a demo verifier (your wallet)
 * 3. Creates a demo lending pool
 *
 * Prerequisites:
 * - Program deployed to devnet (run scripts/deploy.sh first)
 * - Solana CLI configured with a funded wallet
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Obligo } from "../target/types/obligo";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  OBLIGO — Initialize Protocol on Devnet");
  console.log("═══════════════════════════════════════════\n");

  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Obligo as Program<Obligo>;
  const admin = provider.wallet as anchor.Wallet;

  console.log(`Admin:   ${admin.publicKey.toBase58()}`);
  console.log(`Program: ${program.programId.toBase58()}\n`);

  // Derive Protocol PDA
  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol")],
    program.programId
  );

  // Check if already initialized
  try {
    const existing = await program.account.protocol.fetch(protocolPda);
    console.log("⚠ Protocol already initialized. Skipping init.\n");
    console.log(`  Fee:          ${existing.feeBps} bps`);
    console.log(`  Grace period: ${existing.gracePeriodSeconds.toNumber()}s`);
    console.log(`  Pools:        ${existing.poolCount.toNumber()}`);
    console.log(`  Invoices:     ${existing.invoiceCount.toNumber()}`);
    return;
  } catch {
    // Not initialized yet — proceed
  }

  // 1. Initialize Protocol
  console.log("[1/3] Initializing protocol...");
  const FEE_BPS = 200; // 2% fee on profit
  const GRACE_PERIOD = 86400; // 1 day grace period

  await program.methods
    .initializeProtocol(FEE_BPS, new BN(GRACE_PERIOD))
    .accounts({
      protocol: protocolPda,
      admin: admin.publicKey,
      treasury: admin.publicKey, // Treasury = admin for demo
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`  ✓ Protocol initialized at ${protocolPda.toBase58()}`);
  console.log(`    Fee: ${FEE_BPS} bps, Grace: ${GRACE_PERIOD}s\n`);

  // 2. Register admin wallet as a demo verifier
  console.log("[2/3] Registering demo verifier...");
  const [verifierPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("verifier"), admin.publicKey.toBuffer()],
    program.programId
  );

  await program.methods
    .registerVerifier()
    .accounts({
      protocol: protocolPda,
      verifier: verifierPda,
      verifierAuthority: admin.publicKey,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`  ✓ Verifier registered: ${admin.publicKey.toBase58()}\n`);

  // 3. Create a demo pool
  // For devnet, we'll use devnet USDC or create a mock mint
  console.log("[3/3] Creating demo lending pool...");

  // Create mock USDC mint for devnet demo
  const usdcMint = await createMint(
    provider.connection,
    (admin as any).payer,
    admin.publicKey,
    null,
    6 // USDC has 6 decimals
  );
  console.log(`  Mock USDC mint: ${usdcMint.toBase58()}`);

  const vaultKp = Keypair.generate();
  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), new BN(0).toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  await program.methods
    .createPool(
      "Alpha Receivables",
      new BN(50_000_000_000), // 50K USDC max invoice
      500, // 5% min discount
      new BN(90 * 86400) // 90 day max maturity
    )
    .accounts({
      protocol: protocolPda,
      pool: poolPda,
      vault: vaultKp.publicKey,
      usdcMint,
      manager: admin.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([vaultKp])
    .rpc();

  console.log(`  ✓ Pool "Alpha Receivables" created at ${poolPda.toBase58()}`);
  console.log(`    Vault: ${vaultKp.publicKey.toBase58()}\n`);

  console.log("═══════════════════════════════════════════");
  console.log("  ✓ Initialization complete!");
  console.log("═══════════════════════════════════════════\n");
  console.log("Protocol PDA:", protocolPda.toBase58());
  console.log("Verifier PDA:", verifierPda.toBase58());
  console.log("Pool PDA:    ", poolPda.toBase58());
  console.log("USDC Mint:   ", usdcMint.toBase58());
  console.log("\nStart the frontend: cd app && npm run dev");
}

main().catch(console.error);
