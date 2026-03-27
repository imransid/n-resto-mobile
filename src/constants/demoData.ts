import type { AuthUser } from '../types/auth';
import type {
  CatalogItemPrice,
  CatalogModifierGroup,
  CatalogVariantGroup,
} from '../types/posCatalog';

export type DemoUser = AuthUser;

export const DEMO_USERS: Record<string, { user: DemoUser; password: string }> = {
  admin: {
    user: {
      id: 'u1',
      email: 'admin@demo.com',
      name: 'Admin',
      role: 'ADMIN',
      companyId: 'demo-company',
    },
    password: 'Pass@1234',
  },
  staff: {
    user: {
      id: 'u2',
      email: 'staff@demo.com',
      name: 'Staff',
      role: 'STAFF',
      companyId: 'demo-company',
    },
    password: 'Pass@1234',
  },
  waiter: {
    user: {
      id: 'u3',
      email: 'waiter@demo.com',
      name: 'Waiter',
      role: 'STAFF',
      companyId: 'demo-company',
    },
    password: 'Pass@1234',
  },
  deliveryman: {
    user: {
      id: 'u4',
      email: 'deliveryman@demo.com',
      name: 'Delivery Man',
      role: 'STAFF',
      companyId: 'demo-company',
    },
    password: 'Pass@1234',
  },
};

export interface FoodItem {
  id: string;
  item_name: string;
  description: string;
  price: number;
  status: boolean;
  category: string;
  /** Local image path (from DB); when set, POS shows image instead of placeholder */
  item_image_local?: string | null;
  /** From published catalog / pos_meta */
  pricesByChannel?: CatalogItemPrice[];
  variantGroups?: CatalogVariantGroup[];
  modifierGroups?: CatalogModifierGroup[];
}

export const DEMO_FOOD_ITEMS: FoodItem[] = [
  { id: 'f1', item_name: 'Cheese Burger', description: 'Beef patty, cheese, lettuce', price: 4.9, status: true, category: 'Burger' },
  { id: 'f2', item_name: 'Zinger Burger', description: 'Crispy chicken', price: 2.34, status: true, category: 'Burger' },
  { id: 'f3', item_name: 'Hot n Crispy Burger', description: 'Spicy chicken burger', price: 3.7, status: true, category: 'Burger' },
  { id: 'f4', item_name: 'Burger Classic', description: 'Beef patty, lettuce, tomato', price: 12.99, status: true, category: 'Burger' },
  { id: 'f5', item_name: 'Chicken Corn Soup', description: 'Creamy chicken soup', price: 5.99, status: true, category: 'Chinese' },
  { id: 'f6', item_name: 'Grilled Chicken', description: 'Herb-marinated chicken breast', price: 15.99, status: true, category: 'Chinese' },
  { id: 'f7', item_name: 'Vegetable Soup', description: 'Seasonal vegetables', price: 6.99, status: true, category: 'Chinese' },
  { id: 'f8', item_name: 'Pasta Carbonara', description: 'Cream, bacon, parmesan', price: 11.99, status: true, category: 'Chinese' },
  { id: 'f9', item_name: 'Croissant', description: 'Buttery pastry', price: 3.5, status: true, category: 'Pastry' },
  { id: 'f10', item_name: 'Chocolate Muffin', description: 'Fresh baked', price: 2.99, status: true, category: 'Pastry' },
  { id: 'f11', item_name: 'Coca Cola Zero 500ml', description: 'Sugar-free cola', price: 0.99, status: true, category: 'Soft Drink' },
  { id: 'f12', item_name: 'Coca Cola Regular 2.5L', description: 'Classic cola', price: 2.25, status: true, category: 'Soft Drink' },
  { id: 'f13', item_name: 'Orange Juice', description: 'Fresh squeezed', price: 6.8, status: true, category: 'Fruit Juices' },
  { id: 'f14', item_name: 'Fresh Juice', description: 'Orange or apple', price: 5.99, status: true, category: 'Fruit Juices' },
  { id: 'f15', item_name: 'French Fries', description: 'Crispy golden fries', price: 3.5, status: true, category: 'Fries' },
  { id: 'f16', item_name: 'Steak Frites', description: '8oz sirloin, French fries', price: 22.99, status: true, category: 'Fries' },
  { id: 'f17', item_name: 'Fish & Chips', description: 'Beer-battered cod, fries', price: 13.99, status: true, category: 'Fries' },
  { id: 'f18', item_name: 'Margherita Pizza', description: 'Tomato, mozzarella, basil', price: 14.99, status: true, category: 'Pizza' },
  { id: 'f19', item_name: 'Pepperoni Pizza', description: 'Spicy pepperoni, cheese', price: 16.99, status: true, category: 'Pizza' },
  { id: 'f20', item_name: 'Iced Coffee', description: 'Cold brew with milk', price: 4.99, status: true, category: 'Coffee' },
  { id: 'f21', item_name: 'Espresso', description: 'Single shot', price: 2.5, status: true, category: 'Coffee' },
  { id: 'f22', item_name: 'Tiramisu', description: 'Classic Italian dessert', price: 7.99, status: true, category: 'Ice-Cream' },
  { id: 'f23', item_name: 'Vanilla Ice Cream', description: 'House-made', price: 4.5, status: true, category: 'Ice-Cream' },
  { id: 'f24', item_name: 'Caesar Salad', description: 'Romaine, parmesan, croutons', price: 8.99, status: true, category: 'Sandwich' },
  { id: 'f25', item_name: 'Club Sandwich', description: 'Triple-decker with fries', price: 10.99, status: true, category: 'Sandwich' },
];

export const CATEGORIES = [
  { id: 'All', label: 'All' },
  { id: 'Burger', label: 'Burger' },
  { id: 'Chinese', label: 'Chinese' },
  { id: 'Pastry', label: 'Pastry' },
  { id: 'Soft Drink', label: 'Soft Drink' },
  { id: 'Fruit Juices', label: 'Fruit Juices' },
  { id: 'Fries', label: 'Fries' },
  { id: 'Pizza', label: 'Pizza' },
  { id: 'Coffee', label: 'Coffee' },
  { id: 'Ice-Cream', label: 'Ice-Cream' },
  { id: 'Sandwich', label: 'Sandwich' },
];

export const APP_SERVICE_CHARGE = 2;

export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export const DEMO_MODIFIERS: Modifier[] = [
  { id: 'm1', name: 'Extra Sauce', price: 0.5 },
  { id: 'm2', name: 'Salad', price: 0 },
  { id: 'm3', name: 'Ketchup', price: 0 },
  { id: 'm4', name: 'Extra Onions', price: 0.3 },
  { id: 'm5', name: 'Extra Cheese', price: 1.5 },
  { id: 'm6', name: 'Large Size', price: 1 },
];
