'use client';

// ────────────────────────────────────────────────────────────────────────
// Lightweight toast queue. Stable-id semantics: pushing a toast with the
// same id replaces the existing one (so wallet connect→disconnect updates
// in place instead of stacking). Auto-dismiss after 3s.
// ────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastMessage } from '@/types';
import { cn } from '@/lib/utils';

type ToastInput = {
  id: string | number;
  message: string;
  description?: string;
  type: 'success' | 'error' | 'info';
};

type Stored = ToastInput & { _seq: number };

export function useToastQueue() {
  const [items, setItems] = useState<Stored[]>([]);
  const seq = useRef(0);

  const push = useCallback((t: ToastInput) => {
    seq.current += 1;
    setItems((prev) => {
      const without = prev.filter((p) => p.id !== t.id);
      return [...without, { ...t, _seq: seq.current }];
    });
  }, []);

  const dismiss = useCallback((id: string | number) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { items, push, dismiss };
}

const COLOR: Record<ToastInput['type'], string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  error: 'border-red-500/40 bg-red-500/10 text-red-400',
  info: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
};

const ICON: Record<ToastInput['type'], string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
};

export function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: Stored[];
  dismiss: (id: string | number) => void;
}) {
  // Show only the most recent toast — single-slot like Foresight.
  // (Sonner equivalent isn't installed; this is good enough for our needs.)
  const newest = toasts[toasts.length - 1];
  if (!newest) return null;
  return <ToastBubble key={newest._seq} t={newest} dismiss={dismiss} />;
}

function ToastBubble({ t, dismiss }: { t: Stored; dismiss: (id: string | number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), 3000);
    return () => clearTimeout(timer);
  }, [t._seq, t.id, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-20 right-6 z-[100] px-5 py-3 rounded-lg border backdrop-blur-md font-mono text-sm shadow-2xl',
        'animate-toast-in',
        COLOR[t.type],
      )}
    >
      <div>
        {ICON[t.type]} {t.message}
      </div>
      {t.description && (
        <div className="text-xs opacity-70 mt-0.5">{t.description}</div>
      )}
    </div>
  );
}

// Backwards-compat single-toast component for any place still importing
// the old <Toast/> directly. Marked deprecated; remove when refactor lands.
export function Toast({
  message,
  type,
  onDone,
}: {
  message: string;
  type: 'success' | 'error' | 'info';
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={cn('fixed top-20 right-6 z-[100] px-5 py-3 rounded-lg border backdrop-blur-md font-mono text-sm shadow-2xl', COLOR[type])}>
      {ICON[type]} {message}
    </div>
  );
}

export type { ToastMessage };
