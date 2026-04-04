import type { KDSStation } from '../entities/category.entity';

const BREWBAR_KEYWORDS = [
  'beverage',
  'beverages',
  'coffee',
  'cold brew',
  'brew',
  'tea',
  'teas',
  'espresso',
  'latte',
  'cappuccino',
  'americano',
  'mocha',
  'juice',
  'smoothie',
  'shake',
  'soda',
  'drink',
  'drinks',
];

const KITCHEN_KEYWORDS = [
  'food',
  'foods',
  'dessert',
  'desserts',
  'bakery',
  'pastry',
  'pastries',
  'sandwich',
  'sandwiches',
  'breakfast',
  'lunch',
  'meal',
  'meals',
  'snack',
  'snacks',
];

function normalizeName(name?: string | null) {
  return (name ?? '').trim().toLowerCase();
}

function includesKeyword(name: string, keywords: string[]) {
  return keywords.some((keyword) => name.includes(keyword));
}

export function getSuggestedCategoryStation(name?: string | null): KDSStation | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  if (includesKeyword(normalized, BREWBAR_KEYWORDS)) return 'BREWBAR';
  if (includesKeyword(normalized, KITCHEN_KEYWORDS)) return 'KITCHEN';
  return null;
}

export function inferCategoryStation(name?: string | null, fallback: KDSStation = 'KITCHEN'): KDSStation {
  return getSuggestedCategoryStation(name) ?? fallback;
}
