/** POS list / cart line price label */
export function formatMenuMoney(amount: number, currency = 'BDT'): string {
  const n =
    typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  if (currency === 'BDT') {
    const hasFraction = Math.round(n * 100) % 100 !== 0;
    return `৳${hasFraction ? n.toFixed(2) : String(Math.round(n))}`;
  }
  return `$${n.toFixed(2)}`;
}

/** Variant line: Included / +৳X / −৳X */
export function formatPriceDelta(delta: number, currency = 'BDT'): string {
  const n = typeof delta === 'number' && Number.isFinite(delta) ? delta : 0;
  if (n === 0) return 'Included';
  const abs = formatMenuMoney(Math.abs(n), currency);
  return n < 0 ? `−${abs}` : `+${abs}`;
}
