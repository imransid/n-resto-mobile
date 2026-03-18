import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 7,
  tables: [
    tableSchema({
      name: 'key_value',
      columns: [
        { name: 'key', type: 'string', isIndexed: true },
        { name: 'value', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'users',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true, isOptional: true },
        { name: 'email', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'orders',
      columns: [
        { name: 'created_at', type: 'number' },
        { name: 'total', type: 'number' },
        { name: 'payment_method', type: 'string' },
        { name: 'order_type', type: 'string' },
        { name: 'table_number', type: 'string', isOptional: true },
        { name: 'customer_name', type: 'string', isOptional: true },
        { name: 'order_notes', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isOptional: true },
        { name: 'items', type: 'string' },
        { name: 'created_by', type: 'string', isOptional: true, isIndexed: true },
      ],
    }),
    // Master data — offline-first
    tableSchema({
      name: 'food_groups',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'sort_order', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'food_categories',
      columns: [
        { name: 'name', type: 'string', isIndexed: true },
        { name: 'sort_order', type: 'number', isOptional: true },
        { name: 'group_id', type: 'string', isOptional: true, isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'food_items',
      columns: [
        { name: 'item_name', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'status', type: 'boolean' },
        { name: 'category_id', type: 'string', isIndexed: true },
        { name: 'item_image_local', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'food_modifiers',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'price', type: 'number' },
        { name: 'food_id', type: 'string', isOptional: true, isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'available_tables',
      columns: [
        { name: 'number', type: 'string', isIndexed: true },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'is_available', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'customers',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'phone', type: 'string', isOptional: true },
        { name: 'email', type: 'string', isOptional: true },
      ],
    }),
  ],
});
