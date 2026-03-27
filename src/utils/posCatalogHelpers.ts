import type { FoodItem } from '../constants/demoData';
import type { Modifier } from '../types/pos';
import type { CatalogVariantGroup } from '../types/posCatalog';

export function resolveDefaultOptionId(group: CatalogVariantGroup): string | undefined {
  if (group.defaultOptionId) {
    if (group.options.some((o) => o.id === group.defaultOptionId)) {
      return group.defaultOptionId;
    }
  }
  return group.options[0]?.id;
}

/** Modifiers for one-tap add (staff speed). */
export function defaultModifiersForVariantGroups(
  groups: CatalogVariantGroup[] | undefined,
): Modifier[] {
  if (!groups?.length) return [];
  const mods: Modifier[] = [];
  for (const g of groups) {
    const optId = resolveDefaultOptionId(g);
    const opt =
      g.options.find((o) => o.id === optId) ?? g.options[0];
    if (opt) mods.push({ id: opt.id, name: opt.name, price: opt.priceDelta });
  }
  return mods;
}

export function initialVariantSelectionsFromGroups(
  groups: CatalogVariantGroup[] | undefined,
): Record<string, string> {
  const init: Record<string, string> = {};
  if (!groups) return init;
  for (const g of groups) {
    const id = resolveDefaultOptionId(g);
    if (id) init[g.id] = id;
  }
  return init;
}

export function foodHasVariantGroups(food: FoodItem): boolean {
  return (food.variantGroups?.length ?? 0) > 0;
}

/** Min / max sum of `priceDelta` across one choice per variant group (for “from–to” on tiles). */
export function variantDeltaRange(groups: CatalogVariantGroup[] | undefined): {
  min: number;
  max: number;
} {
  if (!groups?.length) return { min: 0, max: 0 };
  let minSum = 0;
  let maxSum = 0;
  for (const g of groups) {
    if (!g.options.length) continue;
    const vals = g.options.map((o) => o.priceDelta);
    minSum += Math.min(...vals);
    maxSum += Math.max(...vals);
  }
  return { min: minSum, max: maxSum };
}

/** Total `priceDelta` for default option in each group (quick-add / card headline). */
export function defaultVariantPriceDeltaSum(groups: CatalogVariantGroup[] | undefined): number {
  return defaultModifiersForVariantGroups(groups).reduce((s, m) => s + Number(m.price) || 0, 0);
}
