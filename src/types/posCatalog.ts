/**
 * Published POS catalog shape (mobile sync / default seed).
 * Align with backend `GET /pos/{id}/catalog/published`.
 */

export type SalesChannel = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export interface CatalogItemPrice {
  channel: SalesChannel;
  amount: number;
  currency: string;
}

export interface CatalogVariantOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface CatalogVariantGroup {
  id: string;
  name: string;
  type: 'single' | 'multi';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: CatalogVariantOption[];
  /**
   * One-tap quick add uses this option when set; must match an entry in `options`.
   * Backend / published JSON can omit; client falls back to first option.
   */
  defaultOptionId?: string;
}

export interface CatalogModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface CatalogModifierGroup {
  id: string;
  name: string;
  type: 'single' | 'multi';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: CatalogModifierOption[];
}

export interface CatalogMenuItem {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  prices: CatalogItemPrice[];
  variantGroups: CatalogVariantGroup[];
  modifierGroups: CatalogModifierGroup[];
}

export interface CatalogCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  items: CatalogMenuItem[];
}

export interface PublishedPosCatalog {
  posId: string;
  currency: string;
  version: number;
  publishedAt: string;
  categories: CatalogCategory[];
}

/** Stored in `food_items.pos_meta` (JSON string). */
export interface FoodItemPosMeta {
  pricesByChannel: CatalogItemPrice[];
  variantGroups: CatalogVariantGroup[];
  modifierGroups?: CatalogModifierGroup[];
}
