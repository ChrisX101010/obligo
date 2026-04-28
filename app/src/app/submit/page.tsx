'use client';

import { useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { InvoiceFormState } from '@/types';
import { log } from '@/lib/log';

const EMPTY: InvoiceFormState = {
  invoiceId: '',
  faceValue: '',
  maturityDate: '',
  debtor: '',
  ipfsHash: '',
};

export default function SubmitPage() {
  const [form, setForm] = useState<InvoiceFormState>(EMPTY);
  const { connected } = useWallet();

  const handleSubmit = useCallback(() => {
    const { invoiceId, faceValue, maturityDate, debtor } = form;
    if (!invoiceId || !faceValue || !maturityDate || !debtor) {
      // eslint-disable-next-line no-alert
      alert('Please fill in all required fields');
      return;
    }
    if (!connected) {
      // eslint-disable-next-line no-alert
      alert('Please connect your wallet first');
      return;
    }
    log('TX', 'Submitting invoice (demo mode)...', form);
    // Pass 2 will replace with a real Anchor `submit_invoice` call.
    // eslint-disable-next-line no-alert
    alert(
      `Demo mode: invoice ${invoiceId} would be submitted on-chain.\nReal Anchor wiring lands in Pass 2.`,
    );
    setForm(EMPTY);
  }, [form, connected]);

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-display font-bold text-white mb-2">
        Submit Invoice
      </h2>
      <p className="text-gray-500 text-sm sm:text-base mb-6 sm:mb-8">
        Tokenize a verified invoice for pool funding. Requires verifier
        co-signature.
      </p>
      <div className="bg-void-800 border border-void-600 rounded-2xl p-5 sm:p-6 md:p-8 space-y-5">
        <Field
          label="Invoice ID"
          required
          value={form.invoiceId}
          onChange={(v) => setForm((f) => ({ ...f, invoiceId: v }))}
          placeholder="INV-2026-049"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Face Value (USDC)"
            required
            type="number"
            value={form.faceValue}
            onChange={(v) => setForm((f) => ({ ...f, faceValue: v }))}
            placeholder="10,000"
          />
          <Field
            label="Maturity Date"
            required
            type="date"
            value={form.maturityDate}
            onChange={(v) => setForm((f) => ({ ...f, maturityDate: v }))}
          />
        </div>
        <Field
          label="Debtor Wallet Address"
          required
          value={form.debtor}
          onChange={(v) => setForm((f) => ({ ...f, debtor: v }))}
          placeholder="Solana wallet address"
        />
        <Field
          label="IPFS Document Hash"
          value={form.ipfsHash}
          onChange={(v) => setForm((f) => ({ ...f, ipfsHash: v }))}
          placeholder="QmYwAPJzv5CZsnA625s3Xf2nemt..."
        />

        <div className="bg-void border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
          <span className="text-amber-400 text-lg mt-0.5 shrink-0" aria-hidden>
            ⚠
          </span>
          <div className="text-xs sm:text-sm text-gray-400">
            <span className="text-amber-400 font-medium">Verifier Required.</span>{' '}
            A registered oracle verifier must co-sign this transaction to attest
            the invoice is legitimate. Contact your verifier before submitting.
          </div>
        </div>

        {!connected && (
          <div className="bg-void border border-red-500/20 rounded-lg p-4 text-xs sm:text-sm text-red-400 flex items-center gap-2">
            <span aria-hidden>⊘</span>
            Connect your wallet to submit invoices.
          </div>
        )}

        <button
          onClick={handleSubmit}
          type="button"
          className="w-full bg-mint text-void py-3 sm:py-3.5 rounded-lg font-display font-bold hover:bg-[#00c9a0] transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-mint/20"
          disabled={!connected}
        >
          {connected ? 'Submit' : 'Connect Wallet First'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'date';
  required?: boolean;
}) {
  const id = `field-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-display font-medium text-gray-400 block mb-2"
      >
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-void border border-void-600 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white font-mono placeholder-gray-600 focus:outline-none transition-all"
      />
    </div>
  );
}
