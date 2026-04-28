// ────────────────────────────────────────────────────────────────────────
// Lightweight structured browser-console logger.
// Categories color-coded so judges scrolling DevTools see at-a-glance
// what's happening — wallet events green, tx events amber, etc.
// ────────────────────────────────────────────────────────────────────────

type Category = 'WALLET' | 'TX' | 'POOL' | 'RPC' | 'INFO';

const COLORS: Record<Category, string> = {
  WALLET: 'color:#00e6b4',
  TX: 'color:#fbbf24',
  POOL: 'color:#818cf8',
  RPC: 'color:#a78bfa',
  INFO: 'color:#94a3b8',
};

export function log(category: Category, message: string, data?: unknown) {
  const ts = new Date().toISOString().split('T')[1].replace('Z', '');
  const prefix = `%c[${ts}] [${category}]`;
  const style = COLORS[category] ?? COLORS.INFO;
  if (data !== undefined) {
    // eslint-disable-next-line no-console
    console.log(prefix, style, message, data);
  } else {
    // eslint-disable-next-line no-console
    console.log(prefix, style, message);
  }
}
