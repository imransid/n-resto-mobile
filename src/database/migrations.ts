import {
  schemaMigrations,
  createTable,
  addColumns,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'key_value',
          columns: [
            { name: 'key', type: 'string', isIndexed: true },
            { name: 'value', type: 'string' },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'users',
          columns: [
            { name: 'email', type: 'string', isIndexed: true },
            { name: 'name', type: 'string' },
          ],
        }),
        createTable({
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
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'users',
          columns: [
            { name: 'user_id', type: 'string', isIndexed: true, isOptional: true },
          ],
        }),
        addColumns({
          table: 'orders',
          columns: [
            { name: 'created_by', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        createTable({
          name: 'food_groups',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'sort_order', type: 'number', isOptional: true },
          ],
        }),
        createTable({
          name: 'food_categories',
          columns: [
            { name: 'name', type: 'string', isIndexed: true },
            { name: 'sort_order', type: 'number', isOptional: true },
            { name: 'group_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        createTable({
          name: 'food_items',
          columns: [
            { name: 'item_name', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'price', type: 'number' },
            { name: 'status', type: 'boolean' },
            { name: 'category_id', type: 'string', isIndexed: true },
          ],
        }),
        createTable({
          name: 'food_modifiers',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'price', type: 'number' },
            { name: 'food_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        createTable({
          name: 'available_tables',
          columns: [
            { name: 'number', type: 'string', isIndexed: true },
            { name: 'name', type: 'string', isOptional: true },
            { name: 'is_available', type: 'boolean' },
          ],
        }),
        createTable({
          name: 'customers',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'phone', type: 'string', isOptional: true },
            { name: 'email', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'orders',
          columns: [{ name: 'created_at_new', type: 'number' }],
        }),
        unsafeExecuteSql(
          `UPDATE orders SET created_at_new = CASE WHEN typeof(created_at) IN ('integer','real') THEN created_at ELSE CAST(strftime('%s', substr(created_at, 1, 19)) AS INTEGER) * 1000 END WHERE created_at IS NOT NULL;`
        ),
        unsafeExecuteSql('ALTER TABLE orders DROP COLUMN created_at;'),
        unsafeExecuteSql('ALTER TABLE orders RENAME COLUMN created_at_new TO created_at;'),
      ],
    },
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'food_items',
          columns: [{ name: 'item_image_local', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'orders',
          columns: [{ name: 'company_id', type: 'string', isOptional: true, isIndexed: true }],
        }),
      ],
    },
    {
      toVersion: 9,
      steps: [
        createTable({
          name: 'total_orders',
          columns: [
            { name: 'order_count', type: 'number' },
            { name: 'paid_count', type: 'number' },
            { name: 'unpaid_count', type: 'number' },
            { name: 'total_value', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 10,
      steps: [
        unsafeExecuteSql('ALTER TABLE total_orders DROP COLUMN total_value;'),
      ],
    },
    {
      toVersion: 11,
      steps: [
        createTable({
          name: 'order_sync_queue',
          columns: [{ name: 'order_id', type: 'string', isIndexed: true }],
        }),
      ],
    },
    {
      toVersion: 12,
      steps: [
        addColumns({
          table: 'orders',
          columns: [{ name: 'paid_at', type: 'number', isOptional: true }],
        }),
        unsafeExecuteSql(
          `UPDATE orders SET paid_at = created_at WHERE status = 'PAID' AND paid_at IS NULL`
        ),
        unsafeExecuteSql(
          `CREATE INDEX IF NOT EXISTS idx_orders_status_paid_at ON orders(status, paid_at)`
        ),
      ],
    },
  ],
});
