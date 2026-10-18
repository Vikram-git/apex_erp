import { date, index, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { money, percent, quantity, timestamps } from './common.js';
import { products, warehouses } from './inventory.js';
import { customers } from './parties.js';

export const salesOrderStatusEnum = pgEnum('sales_order_status', [
  'draft',
  'confirmed',
  'delivered',
  'cancelled',
]);

export const salesOrders = pgTable(
  'sales_orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderNumber: varchar({ length: 30 }).notNull().unique(),
    customerId: uuid()
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    warehouseId: uuid()
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    status: salesOrderStatusEnum().notNull().default('draft'),
    orderDate: date({ mode: 'string' }).notNull(),
    expectedDate: date({ mode: 'string' }),
    subtotal: money().notNull().default(0),
    taxTotal: money().notNull().default(0),
    total: money().notNull().default(0),
    notes: text(),
    createdBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    confirmedAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('sales_orders_customer_id_idx').on(t.customerId),
    index('sales_orders_status_idx').on(t.status),
    index('sales_orders_order_date_idx').on(t.orderDate),
  ],
);

export const salesOrderLines = pgTable(
  'sales_order_lines',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => salesOrders.id, { onDelete: 'cascade' }),
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
  (t) => [index('sales_order_lines_order_id_idx').on(t.orderId)],
);
