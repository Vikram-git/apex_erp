import { date, index, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { money, percent, quantity, timestamps } from './common.js';
import { products, warehouses } from './inventory.js';
import { suppliers } from './parties.js';

export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'draft',
  'approved',
  'received',
  'cancelled',
]);

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderNumber: varchar({ length: 30 }).notNull().unique(),
    supplierId: uuid()
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    warehouseId: uuid()
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    status: purchaseOrderStatusEnum().notNull().default('draft'),
    orderDate: date({ mode: 'string' }).notNull(),
    expectedDate: date({ mode: 'string' }),
    subtotal: money().notNull().default(0),
    taxTotal: money().notNull().default(0),
    total: money().notNull().default(0),
    notes: text(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp({ withTimezone: true }),
    receivedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('purchase_orders_supplier_id_idx').on(t.supplierId),
    index('purchase_orders_status_idx').on(t.status),
    index('purchase_orders_order_date_idx').on(t.orderDate),
  ],
);

export const purchaseOrderLines = pgTable(
  'purchase_order_lines',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    lineNo: integer().notNull(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: quantity().notNull(),
    unitPrice: money().notNull(),
    taxRate: percent().notNull().default(0),
    lineSubtotal: money().notNull(),
    lineTax: money().notNull(),
    lineTotal: money().notNull(),
  },
  (t) => [index('purchase_order_lines_order_id_idx').on(t.orderId)],
);
