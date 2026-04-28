'use client';

// ────────────────────────────────────────────────────────────────────────
// Soft mint-green glow that follows the cursor on desktop. Pure visual
// flair — disabled on mobile where there's no real cursor.
// ────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return <div ref={ref} className="cursor-glow hidden md:block" aria-hidden />;
}
