import type { FoodItem } from '../constants/demoData';
import type { FoodItemPosMeta } from '../types/posCatalog';

export function parseFoodItemPosMeta(
  raw: string | null | undefined,
): Partial<
  Pick<FoodItem, 'pricesByChannel' | 'variantGroups' | 'modifierGroups'>
> {
  if (raw == null || !String(raw).trim()) return {};
  try {
    const o = JSON.parse(raw) as FoodItemPosMeta;
    return {
      pricesByChannel: o.pricesByChannel,
      variantGroups: o.variantGroups,
      modifierGroups: o.modifierGroups,
    };
  } catch {
    return {};
  }
}
