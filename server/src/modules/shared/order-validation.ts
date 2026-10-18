import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { DbOrTx } from '../../db/index.js';
import { products, warehouses } from '../../db/schema/index.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { listQuerySchema, optionalText } from '../../lib/http.js';

const isoDate = z.iso.date('Use YYYY-MM-DD');

export const orderLineSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().positive('Quantity must be greater than zero').max(1e9),
  unitPrice: z.number().min(0).max(1e10),
  taxRate: z.number().min(0).max(100).default(0),
});

export const orderBaseSchema = z
  .object({
    warehouseId: z.uuid(),
    orderDate: isoDate,
    expectedDate: isoDate.nullish(),
    notes: optionalText(2000),
    lines: z.array(orderLineSchema).min(1, 'Add at least one line').max(200),
  })
  .refine((v) => !v.expectedDate || v.expectedDate >= v.orderDate, {
    message: 'Expected date cannot be before the order date',
    path: ['expectedDate'],
  });

export const orderListQuery = listQuerySchema.extend({
  partyId: z.uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

/** Ensures the warehouse and every product referenced by an order exist and are active. */
export async function assertOrderReferences(tx: DbOrTx, warehouseId: string, productIds: string[]) {
  const [warehouse] = await tx
    .select({ isActive: warehouses.isActive })
    .from(warehouses)
    .where(eq(warehouses.id, warehouseId));
  if (!warehouse) throw notFound('Warehouse');
  if (!warehouse.isActive) throw badRequest('Selected warehouse is inactive');

  const unique = [...new Set(productIds)];
  const found = await tx
    .select({ id: products.id })
    .from(products)
    .where(and(inArray(products.id, unique), eq(products.isActive, true)));
  if (found.length !== unique.length) {
    throw badRequest('One or more products are missing or inactive');
  }
}
