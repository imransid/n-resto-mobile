/**
 * Database instance only. Use this from modules that must not create a circular
 * dependency with index.ts (e.g. seedMasterData).
 */
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import { migrations } from './migrations';
import KeyValue from './KeyValue';
import User from './User';
import Order from './Order';
import FoodGroup from './FoodGroup';
import FoodCategory from './FoodCategory';
import FoodItem from './FoodItem';
import FoodModifier from './FoodModifier';
import AvailableTable from './AvailableTable';
import Customer from './Customer';
import TotalOrder from './TotalOrder';
import OrderSyncQueue from './OrderSyncQueue';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    KeyValue,
    User,
    Order,
    FoodGroup,
    FoodCategory,
    FoodItem,
    FoodModifier,
    AvailableTable,
    Customer,
    TotalOrder,
    OrderSyncQueue,
  ],
});
