"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

// ══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════
const PROGRAM_ID = "G2U6oqyujU8xWFwXMeejavMCbYYJNRSqromMJrYH5a3W";
const GITHUB_URL = "https://github.com/ChrisX101010/obligo";
const DOCS_URL = "https://github.com/ChrisX101010/obligo/blob/main/docs/ARCHITECTURE.md";
const EXPLORER_URL = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`;

const MOCK_POOLS = [
  { name: "Alpha Receivables", tvl: 2_450_000, apy: 8.4, invoicesFunded: 47, utilization: 62, minDiscount: 5, maxMaturity: 90 },
  { name: "SMB Trade Finance", tvl: 890_000, apy: 11.2, invoicesFunded: 23, utilization: 78, minDiscount: 7, maxMaturity: 60 },
  { name: "Cross-Border Pool", tvl: 5_100_000, apy: 6.9, invoicesFunded: 112, utilization: 45, minDiscount: 3, maxMaturity: 120 },
];

const MOCK_INVOICES = [
  { id: "INV-2026-047", seller: "4kN2...x9Fp", debtor: "7bR3...mQ2z", faceValue: 25_000, fundedAmount: 23_750, status: "Funded", maturity: "2026-05-15", discount: 5.0 },
  { id: "INV-2026-048", seller: "9vT1...pK4w", debtor: "2cL8...nR7j", faceValue: 12_500, fundedAmount: 0, status: "Submitted", maturity: "2026-06-01", discount: 0 },
  { id: "INV-2026-045", seller: "6mW5...hD3q", debtor: "8eJ2...bV9t", faceValue: 50_000, fundedAmount: 46_500, status: "Settled", maturity: "2026-04-10", discount: 7.0 },
  { id: "INV-2026-041", seller: "3aK7...sF1y", debtor: "5gN4...wC6p", faceValue: 8_000, fundedAmount: 7_600, status: "Repaid", maturity: "2026-04-18", discount: 5.0 },
];

const STATUS_COLORS: Record<string, string> = {
  Submitted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Funded: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Repaid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Settled: "bg-green-500/20 text-green-300 border-green-500/30",
  Defaulted: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STEPS = [
  { num: "01", title: "Verify", desc: "Oracle verifier attests invoice authenticity off-chain, confirming the debtor and amount are legitimate.", detail: "Verifiers are registered by the protocol admin. Each verifier must co-sign the submit_invoice transaction, creating a non-replayable attestation bound to this specific invoice." },
  { num: "02", title: "Submit", desc: "Seller tokenizes invoice on-chain with verifier co-signature as a PDA-backed asset.", detail: "The invoice PDA stores face value, maturity, debtor address, IPFS document hash, and verifier identity. Sequential indexing prevents seed collisions." },
  { num: "03", title: "Fund", desc: "Pool manager purchases invoice at a discount, sending USDC from the pool vault to the seller.", detail: "Funding requires discount >= pool minimum, face value <= pool max, and maturity within bounds. The funded amount is calculated as face_value × (10000 - discount_bps) / 10000." },
  { num: "04", title: "Repay", desc: "Debtor pays full face value before maturity. Only the debtor wallet can execute repayment.", detail: "The has_one = debtor constraint enforces that only the original debtor can repay. Full face value goes to the pool vault pending settlement." },
  { num: "05", title: "Settle", desc: "Protocol distributes returns: fee to treasury, profit to pool. Permissionless — anyone can crank.", detail: "Fee is calculated on profit only (face_value - funded_amount), not the full amount. Net return increases pool NAV, benefiting all LP holders proportionally." },
];

// ══════════════════════════════════════════════════════════════════════
// LOGGER — prints timestamped events to browser console
// ══════════════════════════════════════════════════════════════════════
function log(category: string, message: string, data?: any) {
  const ts = new Date().toISOString().split("T")[1].replace("Z", "");
  const prefix = `%c[${ts}] [${category}]`;
  const style = category === "WALLET" ? "color:#00e6b4" : category === "TX" ? "color:#fbbf24" : category === "POOL" ? "color:#818cf8" : "color:#94a3b8";
  if (data) { console.log(prefix, style, message, data); }
  else { console.log(prefix, style, message); }
}

// ══════════════════════════════════════════════════════════════════════
// TOAST COMPONENT
// ══════════════════════════════════════════════════════════════════════
function Toast({ message, type, onDone }: { message: string; type: "success" | "error" | "info"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  const colors = type === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : type === "error" ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-blue-500/40 bg-blue-500/10 text-blue-400";
  return (
    <div className={`toast fixed top-20 right-6 z-[100] px-5 py-3 rounded-lg border ${colors} backdrop-blur-md font-mono text-sm shadow-2xl`}>
      {type === "success" && "✓ "}{type === "error" && "✗ "}{type === "info" && "ℹ "}{message}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// LOGO COMPONENT
// ══════════════════════════════════════════════════════════════════════
function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="36" height="36" rx="8" fill="#0f0f1a" stroke="#00e6b4" strokeWidth="1.5" strokeOpacity="0.3"/>
        <circle cx="18" cy="18" r="9" fill="none" stroke="#00e6b4" strokeWidth="2"/>
        <circle cx="18" cy="18" r="3.5" fill="#00e6b4"/>
        <line x1="18" y1="9" x2="18" y2="12" stroke="#00e6b4" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="18" y1="24" x2="18" y2="27" stroke="#00e6b4" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="9" y1="18" x2="12" y2="18" stroke="#00e6b4" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="24" y1="18" x2="27" y2="18" stroke="#00e6b4" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div className="flex items-baseline gap-2">
        <span className="font-display font-bold text-xl text-white tracking-tight">
          <span className="text-mint">0</span>BLIG<span className="text-mint">0</span>
        </span>
        <span className="text-[9px] bg-mint/10 text-mint px-2 py-0.5 rounded-full font-mono border border-mint/20 uppercase tracking-wider">
          Devnet
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// STAT CARD
// ══════════════════════════════════════════════════════════════════════
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card bg-void-800 border border-void-600 rounded-xl p-6 hover:border-mint/20 transition-all duration-300">
      <div className="text-sm text-gray-500 font-medium mb-1">{label}</div>
      <div className="text-2xl font-display font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-mint mt-1">{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// DEPOSIT MODAL
// ══════════════════════════════════════════════════════════════════════
function DepositModal({ pool, onClose, onDeposit }: { pool: typeof MOCK_POOLS[0]; onClose: () => void; onDeposit: (amt: number) => void }) {
  const [amount, setAmount] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-void-800 border border-void-600 rounded-2xl p-8 w-full max-w-md mx-4 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl">&times;</button>
        <h3 className="font-display font-bold text-xl text-white mb-1">Deposit to {pool.name}</h3>
        <p className="text-gray-500 text-sm mb-6">Current APY: <span className="text-mint">{pool.apy}%</span> · TVL: ${(pool.tvl / 1e6).toFixed(2)}M</p>
        <label className="text-sm font-medium text-gray-400 block mb-2">Amount (USDC)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1,000" className="w-full bg-void border border-void-600 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-600 focus:outline-none transition-all mb-6" />
        <button onClick={() => { if (Number(amount) > 0) onDeposit(Number(amount)); }} className="w-full bg-mint text-void py-3 rounded-lg font-display font-bold hover:bg-[#00c9a0] transition-all disabled:opacity-40" disabled={!amount || Number(amount) <= 0}>
          Deposit USDC
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN APP (INNER — HAS WALLET CONTEXT)
// ══════════════════════════════════════════════════════════════════════
function AppInner() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "pools" | "invoices" | "submit">("dashboard");
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "success" | "error" | "info" }[]>([]);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [depositPool, setDepositPool] = useState<typeof MOCK_POOLS[0] | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Invoice form state
  const [invoiceForm, setInvoiceForm] = useState({ invoiceId: "", faceValue: "", maturityDate: "", debtor: "", ipfsHash: "" });

  const wallet = useWallet();
  const { connection } = useConnection();
  const toastId = useRef(0);

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  // Cursor glow follower
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.left = e.clientX + "px";
        cursorRef.current.style.top = e.clientY + "px";
      }
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Wallet connection logging
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      log("WALLET", `Connected: ${wallet.publicKey.toBase58()}`);
      addToast(`Wallet connected: ${wallet.publicKey.toBase58().slice(0, 4)}...${wallet.publicKey.toBase58().slice(-4)}`, "success");
    }
    if (wallet.disconnecting) {
      log("WALLET", "Disconnecting...");
    }
  }, [wallet.connected, wallet.disconnecting, wallet.publicKey, addToast]);

  // Submit invoice handler
  const handleSubmitInvoice = useCallback(() => {
    const { invoiceId, faceValue, maturityDate, debtor, ipfsHash } = invoiceForm;
    if (!invoiceId || !faceValue || !maturityDate || !debtor) {
      addToast("Please fill in all required fields", "error");
      return;
    }
    if (!wallet.connected) {
      addToast("Please connect your wallet first", "error");
      return;
    }
    log("TX", "Submitting invoice...", { invoiceId, faceValue, maturityDate, debtor, ipfsHash });
    addToast(`Invoice ${invoiceId} submitted to devnet (demo mode)`, "success");
    log("TX", `Invoice ${invoiceId} submitted successfully`);
    setInvoiceForm({ invoiceId: "", faceValue: "", maturityDate: "", debtor: "", ipfsHash: "" });
  }, [invoiceForm, wallet.connected, addToast]);

  // Deposit handler
  const handleDeposit = useCallback((amount: number) => {
    if (!wallet.connected) {
      addToast("Please connect your wallet first", "error");
      return;
    }
    log("POOL", `Depositing ${amount} USDC to ${depositPool?.name}`, { amount, pool: depositPool?.name });
    addToast(`Deposited ${amount.toLocaleString()} USDC to ${depositPool?.name} (demo mode)`, "success");
    setDepositPool(null);
  }, [wallet.connected, depositPool, addToast]);

  const walletAddr = wallet.publicKey?.toBase58();
  const shortAddr = walletAddr ? `${walletAddr.slice(0, 4)}...${walletAddr.slice(-4)}` : null;

  return (
    <div className="min-h-screen bg-void relative">
      {/* Lattice background */}
      <div className="lattice-bg" />
      {/* Cursor glow */}
      <div ref={cursorRef} className="cursor-glow hidden md:block" />
      {/* Toasts */}
      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onDone={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
      ))}
      {/* Deposit Modal */}
      {depositPool && <DepositModal pool={depositPool} onClose={() => setDepositPool(null)} onDeposit={handleDeposit} />}

      {/* ── Navigation ── */}
      <nav className="border-b border-void-600 bg-void/80 backdrop-blur-xl sticky top-0 z-50 relative">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <Logo />
          {/* Desktop tabs */}
          <div className="nav-tabs hidden md:flex items-center gap-1 bg-void-800 rounded-lg p-1 border border-void-600">
            {(["dashboard", "pools", "invoices", "submit"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab ? "bg-mint/10 text-mint border border-mint/20" : "text-gray-400 hover:text-white"}`}>
                {tab === "submit" ? "Submit Invoice" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <WalletMultiButton />
            {/* Mobile hamburger */}
            <button onClick={() => setMobileNav(!mobileNav)} className="md:hidden text-gray-400 hover:text-white p-2">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
        </div>
        {/* Mobile nav dropdown */}
        {mobileNav && (
          <div className="md:hidden border-t border-void-600 bg-void-800 px-4 py-3 flex flex-col gap-2">
            {(["dashboard", "pools", "invoices", "submit"] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setMobileNav(false); }}
                className={`px-4 py-2 rounded-md text-sm font-medium text-left ${activeTab === tab ? "bg-mint/10 text-mint" : "text-gray-400"}`}>
                {tab === "submit" ? "Submit Invoice" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 relative z-10">
        {/* ═══ DASHBOARD ═══ */}
        {activeTab === "dashboard" && (
          <div>
            {/* Hero */}
            <div className="mb-12 relative overflow-hidden rounded-2xl bg-gradient-to-br from-void-800 to-void border border-void-600 p-8 md:p-12">
              <div className="absolute top-0 right-0 w-96 h-96 bg-mint/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-glow-pulse" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-mint/3 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
              <div className="relative">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-4 leading-tight">
                  Invoice Factoring,<br />
                  <span className="text-mint">On-Chain.</span>
                </h1>
                <p className="text-gray-400 text-lg max-w-xl mb-8 leading-relaxed">
                  Tokenize verified invoices as on-chain assets. Fund them through programmable lending pools. Settle automatically when paid. All on Solana.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setActiveTab("submit")} className="bg-mint text-void px-6 py-3 rounded-lg font-display font-semibold hover:bg-[#00c9a0] transition-all hover:shadow-lg hover:shadow-mint/20">
                    Submit Invoice
                  </button>
                  <button onClick={() => setActiveTab("pools")} className="bg-void-800 border border-void-600 text-white px-6 py-3 rounded-lg font-display font-semibold hover:border-mint/30 transition-all">
                    Explore Pools
                  </button>
                  <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="bg-void-800 border border-void-600 text-gray-400 px-6 py-3 rounded-lg font-display font-semibold hover:border-mint/30 hover:text-white transition-all">
                    View on Explorer ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <StatCard label="Total Value Locked" value="$8.44M" sub="+12.3% this week" />
              <StatCard label="Invoices Funded" value="182" sub="47 active" />
              <StatCard label="Default Rate" value="1.2%" sub="Below industry avg" />
              <StatCard label="Avg Pool APY" value="8.8%" sub="Net of fees" />
            </div>

            {/* How It Works */}
            <div className="bg-void-800 border border-void-600 rounded-2xl p-6 md:p-8 mb-10">
              <h2 className="text-xl font-display font-bold text-white mb-8">How It Works</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                {STEPS.map((step, i) => (
                  <div key={i} className="step-card rounded-xl p-5 bg-void-900 cursor-pointer" onClick={() => setExpandedStep(expandedStep === i ? null : i)}>
                    <div className="step-number text-3xl md:text-4xl font-display font-bold text-mint/20 mb-2 transition-all duration-500">
                      {step.num}
                    </div>
                    <div className="step-title font-display font-semibold text-gray-300 mb-2 transition-all duration-300">{step.title}</div>
                    <div className="text-gray-500 text-sm leading-relaxed">{step.desc}</div>
                    {expandedStep === i && (
                      <div className="mt-3 pt-3 border-t border-void-600 text-mint/70 text-xs leading-relaxed animate-fade-in">
                        {step.detail}
                      </div>
                    )}
                    {i < 4 && <div className="hidden md:block text-void-600 text-right text-lg mt-2">→</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-void-800 border border-void-600 rounded-2xl p-6 md:p-8">
              <h2 className="text-xl font-display font-bold text-white mb-6">Recent Activity</h2>
              <div className="space-y-1">
                {MOCK_INVOICES.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-4 border-b border-void-600/50 last:border-0 hover:bg-void-900/50 px-3 rounded-lg transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm text-white">{inv.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-white">${inv.faceValue.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Due {inv.maturity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ POOLS ═══ */}
        {activeTab === "pools" && (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-6">Lending Pools</h2>
            <div className="grid gap-4">
              {MOCK_POOLS.map((pool, i) => (
                <div key={i} className="pool-card bg-void-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-display font-bold text-white text-lg">{pool.name}</h3>
                      <span className="text-xs text-gray-500 font-mono">Pool #{i} · Min {pool.minDiscount}% discount · Max {pool.maxMaturity}d maturity</span>
                    </div>
                    <button onClick={() => { log("POOL", `Opening deposit modal for ${pool.name}`); setDepositPool(pool); }}
                      className="bg-mint/10 text-mint px-5 py-2.5 rounded-lg text-sm font-display font-semibold border border-mint/20 hover:bg-mint/20 transition-all">
                      Deposit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">TVL</div>
                      <div className="font-display font-semibold text-white">${(pool.tvl / 1e6).toFixed(2)}M</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">APY</div>
                      <div className="font-display font-semibold text-mint">{pool.apy}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Funded</div>
                      <div className="font-display font-semibold text-white">{pool.invoicesFunded}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Utilization</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-void-600 rounded-full overflow-hidden">
                          <div className="h-full bg-mint rounded-full transition-all duration-1000" style={{ width: `${pool.utilization}%` }} />
                        </div>
                        <span className="text-xs font-mono text-gray-400">{pool.utilization}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ INVOICES ═══ */}
        {activeTab === "invoices" && (
          <div>
            <h2 className="text-2xl font-display font-bold text-white mb-6">Invoice Registry</h2>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {MOCK_INVOICES.map(inv => (
                <div key={inv.id} className="bg-void-800 border border-void-600 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-mono text-sm text-white">{inv.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Face:</span> <span className="text-white">${inv.faceValue.toLocaleString()}</span></div>
                    <div><span className="text-gray-500">Funded:</span> <span className="text-white">{inv.fundedAmount > 0 ? `$${inv.fundedAmount.toLocaleString()}` : "—"}</span></div>
                    <div><span className="text-gray-500">Discount:</span> <span className="text-white">{inv.discount > 0 ? `${inv.discount}%` : "—"}</span></div>
                    <div><span className="text-gray-500">Due:</span> <span className="text-white">{inv.maturity}</span></div>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block bg-void-800 border border-void-600 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-void-900">
                  <tr>
                    {["Invoice", "Seller", "Debtor", "Face Value", "Funded", "Discount", "Maturity", "Status"].map(h => (
                      <th key={h} className="text-left text-xs font-display font-medium text-gray-500 px-4 py-3 border-b border-void-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_INVOICES.map(inv => (
                    <tr key={inv.id} className="border-b border-void-600/50 hover:bg-void-900/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-white">{inv.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-400 font-mono">{inv.seller}</td>
                      <td className="px-4 py-3 text-sm text-gray-400 font-mono">{inv.debtor}</td>
                      <td className="px-4 py-3 text-sm font-mono text-white">${inv.faceValue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-mono text-white">{inv.fundedAmount > 0 ? `$${inv.fundedAmount.toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-400">{inv.discount > 0 ? `${inv.discount}%` : "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{inv.maturity}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[inv.status]}`}>{inv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ SUBMIT INVOICE ═══ */}
        {activeTab === "submit" && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-display font-bold text-white mb-2">Submit Invoice</h2>
            <p className="text-gray-500 mb-8">Tokenize a verified invoice for pool funding. Requires verifier co-signature.</p>
            <div className="bg-void-800 border border-void-600 rounded-2xl p-6 md:p-8 space-y-5">
              <div>
                <label className="text-sm font-display font-medium text-gray-400 block mb-2">Invoice ID <span className="text-red-400">*</span></label>
                <input type="text" value={invoiceForm.invoiceId} onChange={e => setInvoiceForm(f => ({ ...f, invoiceId: e.target.value }))}
                  placeholder="INV-2026-049" className="w-full bg-void border border-void-600 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-600 focus:outline-none transition-all" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-display font-medium text-gray-400 block mb-2">Face Value (USDC) <span className="text-red-400">*</span></label>
                  <input type="number" value={invoiceForm.faceValue} onChange={e => setInvoiceForm(f => ({ ...f, faceValue: e.target.value }))}
                    placeholder="10,000" className="w-full bg-void border border-void-600 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-600 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="text-sm font-display font-medium text-gray-400 block mb-2">Maturity Date <span className="text-red-400">*</span></label>
                  <input type="date" value={invoiceForm.maturityDate} onChange={e => setInvoiceForm(f => ({ ...f, maturityDate: e.target.value }))}
                    className="w-full bg-void border border-void-600 rounded-lg px-4 py-3 text-white font-mono focus:outline-none transition-all" />
                </div>
              </div>
              <div>
                <label className="text-sm font-display font-medium text-gray-400 block mb-2">Debtor Wallet Address <span className="text-red-400">*</span></label>
                <input type="text" value={invoiceForm.debtor} onChange={e => setInvoiceForm(f => ({ ...f, debtor: e.target.value }))}
                  placeholder="7bR3...mQ2z or full Solana address" className="w-full bg-void border border-void-600 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-600 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="text-sm font-display font-medium text-gray-400 block mb-2">IPFS Document Hash</label>
                <input type="text" value={invoiceForm.ipfsHash} onChange={e => setInvoiceForm(f => ({ ...f, ipfsHash: e.target.value }))}
                  placeholder="QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG" className="w-full bg-void border border-void-600 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-600 focus:outline-none transition-all" />
              </div>
              <div className="bg-void border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
                <span className="text-amber-400 text-lg mt-0.5">⚠</span>
                <div className="text-sm text-gray-400">
                  <span className="text-amber-400 font-medium">Verifier Required.</span> A registered oracle verifier must co-sign this transaction to attest the invoice is legitimate. Contact your verifier before submitting.
                </div>
              </div>
              {!wallet.connected && (
                <div className="bg-void border border-red-500/20 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2">
                  <span>⊘</span> Connect your wallet to submit invoices.
                </div>
              )}
              <button onClick={handleSubmitInvoice}
                className="w-full bg-mint text-void py-3.5 rounded-lg font-display font-bold hover:bg-[#00c9a0] transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-mint/20"
                disabled={!wallet.connected}>
                {wallet.connected ? "Submit" : "Connect Wallet First"}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-void-600 mt-20 py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="8" fill="#0f0f1a"/><circle cx="18" cy="18" r="7" fill="none" stroke="#00e6b4" strokeWidth="2"/><circle cx="18" cy="18" r="2.5" fill="#00e6b4"/></svg>
            <span className="font-display text-sm text-gray-500">
              Obligo Protocol · Solana Frontier Hackathon 2026
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600 font-mono text-xs">{PROGRAM_ID.slice(0, 8)}...{PROGRAM_ID.slice(-4)}</span>
            <span className="text-void-600">|</span>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-mint transition-colors font-display">GitHub</a>
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-mint transition-colors font-display">Docs</a>
            <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-mint transition-colors font-display">Explorer</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ROOT — WALLET PROVIDERS
// ══════════════════════════════════════════════════════════════════════
export default function Home() {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppInner />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
