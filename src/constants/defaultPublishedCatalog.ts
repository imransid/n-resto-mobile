/**
 * Default published POS catalog (BDT kebab menu). Source: in-house menu; sync with backend when available.
 * IDs match catalog contract for API replace later.
 */
import type {
  CatalogCategory,
  CatalogMenuItem,
  PublishedPosCatalog,
} from '../types/posCatalog';

const DESC = 'Small · Mid · Big · চিকেন · বিফ · মাটন';

type MenuDef = {
  slug: string;
  title: string;
  base: number;
  beefDelta: number;
  muttonDelta: number;
};

function buildItem(
  itemIdPrefix: string,
  namePrefix: string,
  d: MenuDef,
  displayOrder: number,
): CatalogMenuItem {
  const id = `${itemIdPrefix}-${d.slug}`;
  const base = d.base;
  /** Portion pricing: Small lighter plate, Mid = menu baseline, Big generous portion. */
  const smallOff = -Math.max(60, Math.round(base * 0.2));
  const bigAdd = Math.max(90, Math.round(base * 0.32));
  const smallId = `opt-${id}-size-sm`;
  const midId = `opt-${id}-size-mid`;
  const bigId = `opt-${id}-size-big`;
  const chickenId = `opt-${id}-chicken`;
  return {
    id,
    name: `${namePrefix} ${d.title}`,
    description: DESC,
    displayOrder,
    isActive: true,
    prices: [
      { channel: 'DINE_IN', amount: base, currency: 'BDT' },
      { channel: 'TAKEAWAY', amount: base, currency: 'BDT' },
    ],
    variantGroups: [
      {
        id: `variant-size-${id}`,
        name: 'Size',
        type: 'single',
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        defaultOptionId: midId,
        options: [
          { id: smallId, name: 'Small', priceDelta: smallOff },
          { id: midId, name: 'Mid', priceDelta: 0 },
          { id: bigId, name: 'Big', priceDelta: bigAdd },
        ],
      },
      {
        id: `variant-protein-${id}`,
        name: 'Protein',
        type: 'single',
        isRequired: true,
        minSelect: 1,
        maxSelect: 1,
        defaultOptionId: chickenId,
        options: [
          { id: chickenId, name: 'Chicken', priceDelta: 0 },
          { id: `opt-${id}-beef`, name: 'Beef', priceDelta: d.beefDelta },
          { id: `opt-${id}-mutton`, name: 'Mutton', priceDelta: d.muttonDelta },
        ],
      },
    ],
    modifierGroups: [],
  };
}

/** Turkish section — order matches printed menu flow */
const TURKISH_DEFS: MenuDef[] = [
  { slug: 'adnani', title: 'Adnani Kebab', base: 950, beefDelta: 1250, muttonDelta: 2550 },
  { slug: 'boti', title: 'Boti Kebab', base: 770, beefDelta: 980, muttonDelta: 1330 },
  { slug: 'buttery', title: 'Buttery Kebab', base: 790, beefDelta: 700, muttonDelta: 1210 },
  { slug: 'checha', title: 'Checha Kebab', base: 480, beefDelta: 1140, muttonDelta: 1600 },
  { slug: 'cheesy', title: 'Cheesy Kebab', base: 450, beefDelta: 1250, muttonDelta: 2030 },
  { slug: 'crispy', title: 'Crispy Kebab', base: 920, beefDelta: 680, muttonDelta: 1160 },
  { slug: 'egg', title: 'Egg Kebab', base: 300, beefDelta: 1000, muttonDelta: 2000 },
  { slug: 'juicy', title: 'Juicy Kebab', base: 980, beefDelta: 550, muttonDelta: 1000 },
  { slug: 'jura', title: 'Jura Kebab', base: 400, beefDelta: 1480, muttonDelta: 2600 },
  { slug: 'malai', title: 'Malai Kebab', base: 1200, beefDelta: 200, muttonDelta: 700 },
  { slug: 'mixed', title: 'Mixed Kebab', base: 600, beefDelta: 1300, muttonDelta: 1980 },
  { slug: 'muitta', title: 'Muitta Kebab', base: 1290, beefDelta: 400, muttonDelta: 710 },
  { slug: 'roll', title: 'Roll Kebab', base: 580, beefDelta: 620, muttonDelta: 1700 },
];

/** Afghani section — different display order */
const AFGHAN_DEFS: MenuDef[] = [
  { slug: 'malai', title: 'Malai Kebab', base: 1200, beefDelta: 200, muttonDelta: 700 },
  { slug: 'juicy', title: 'Juicy Kebab', base: 980, beefDelta: 550, muttonDelta: 1000 },
  { slug: 'buttery', title: 'Buttery Kebab', base: 790, beefDelta: 700, muttonDelta: 1210 },
  { slug: 'crispy', title: 'Crispy Kebab', base: 920, beefDelta: 680, muttonDelta: 1160 },
  { slug: 'roll', title: 'Roll Kebab', base: 580, beefDelta: 620, muttonDelta: 1700 },
  { slug: 'muitta', title: 'Muitta Kebab', base: 1290, beefDelta: 400, muttonDelta: 710 },
  { slug: 'boti', title: 'Boti Kebab', base: 770, beefDelta: 980, muttonDelta: 1330 },
  { slug: 'checha', title: 'Checha Kebab', base: 480, beefDelta: 1140, muttonDelta: 1600 },
  { slug: 'mixed', title: 'Mixed Kebab', base: 600, beefDelta: 1300, muttonDelta: 1980 },
  { slug: 'cheesy', title: 'Cheesy Kebab', base: 450, beefDelta: 1250, muttonDelta: 2030 },
  { slug: 'egg', title: 'Egg Kebab', base: 300, beefDelta: 1000, muttonDelta: 2000 },
  { slug: 'jora', title: 'Jora Kebab', base: 400, beefDelta: 1480, muttonDelta: 2600 },
  { slug: 'adnani', title: 'Adnani Kebab', base: 950, beefDelta: 1250, muttonDelta: 2550 },
];

function buildCategory(
  id: string,
  name: string,
  displayOrder: number,
  itemPrefix: string,
  labelPrefix: string,
  defs: MenuDef[],
): CatalogCategory {
  return {
    id,
    name,
    displayOrder,
    isActive: true,
    items: defs.map((d, i) => buildItem(itemPrefix, labelPrefix, d, i + 1)),
  };
}

export const DEFAULT_PUBLISHED_POS_CATALOG: PublishedPosCatalog = {
  posId: 'pos-001',
  currency: 'BDT',
  version: 2,
  publishedAt: '2026-03-27T00:00:00Z',
  categories: [
    buildCategory('cat-turkish-kebab', 'Turkish Kebab', 1, 'tk', 'Turkish', TURKISH_DEFS),
    buildCategory('cat-afghani-kebab', 'Afghani Kebab', 2, 'afg', 'Afghani', AFGHAN_DEFS),
  ],
};
