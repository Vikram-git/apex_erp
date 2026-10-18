import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { money, percent, quantity, timestamps } from './common.js';

export const productTypeEnum = pgEnum('product_type', [
  'raw_material',
  'semi_finished',
  'finished_good',
  'consumable',
]);

export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'opening',
  'purchase_receipt',
  'sales_delivery',
  'adjustment',
  'transfer_in',
  'transfer_out',
]);

export const categories = pgTable('categories', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 100 }).notNull().unique(),
  description: varchar({ length: 255 }),
  ...timestamps,
});

export const products = pgTable(
  'products',
  {
    id: uuid().primaryKey().defaultRandom(),
    sku: varchar({ length: 50 }).notNull().unique(),
    name: varchar({ length: 200 }).notNull(),
    description: text(),
    type: productTypeEnum().notNull(),
    categoryId: uuid().references(() => categories.id, { onDelete: 'set null' }),
    uom: varchar({ length: 20 }).notNull().default('pcs'),
    costPrice: money().notNull().default(0),
    salePrice: money().notNull().default(0),
    taxRate: percent().notNull().default(0),
    reorderLevel: quantity().notNull().default(0),
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('products_name_idx').on(t.name),
    index('products_category_id_idx').on(t.categoryId),
  ],
);

export const warehouses = pgTable('warehouses', {
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 20 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  address: text(),
  isActive: boolean().notNull().default(true),
  ...timestamps,
});

export const stockLevels = pgTable(
  'stock_levels',
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    warehouseId: uuid()
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    quantity: quantity().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.productId, t.warehouseId] })],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    warehouseId: uuid()
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    type: stockMovementTypeEnum().notNull(),
    // Signed: positive for inbound, negative for outbound
    quantity: quantity().notNull(),
    balanceAfter: quantity().notNull(),
    referenceType: varchar({ length: 30 }),
    referenceId: uuid(),
    referenceNumber: varchar({ length: 30 }),
    note: varchar({ length: 255 }),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('stock_movements_product_id_idx').on(t.productId),
    index('stock_movements_warehouse_id_idx').on(t.warehouseId),
    index('stock_movements_reference_idx').on(t.referenceType, t.referenceId),
    index('stock_movements_created_at_idx').on(t.createdAt),
  ],
);
