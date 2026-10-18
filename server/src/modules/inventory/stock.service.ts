import { eq, sql } from 'drizzle-orm';
import type { Transaction } from '../../db/index.js';
import { products, stockLevels, stockMovements } from '../../db/schema/index.js';
import { conflict } from '../../lib/errors.js';
import { round3 } from '../../lib/money.js';

type MovementType = (typeof stockMovements.$inferInsert)['type'];

export interface StockMovementInput {
  productId: string;
  warehouseId: string;
  /** Signed quantity: positive adds stock, negative removes it. */
  quantity: number;
  type: MovementType;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  note?: string | null;
  userId: string;
}

/**
 * The single entry point for changing stock. Updates the balance atomically and
 * records the ledger entry; must run inside the caller's transaction so the
 * business document and the stock change commit or roll back together.
 */
export async function applyStockMovement(tx: Transaction, input: StockMovementInput) {
  const delta = round3(input.quantity);

  const [level] = await tx
    .insert(stockLevels)
    .values({ productId: input.productId, warehouseId: input.warehouseId, quantity: delta })
    .onConflictDoUpdate({
      target: [stockLevels.productId, stockLevels.warehouseId],
      set: { quantity: sql`${stockLevels.quantity} + ${delta}`, updatedAt: new Date() },
    })
    .returning({ quantity: stockLevels.quantity });

  if (!level) throw new Error('Failed to update stock level');

  if (level.quantity < 0) {
    const [product] = await tx
      .select({ sku: products.sku, name: products.name })
      .from(products)
      .where(eq(products.id, input.productId));
    const available = round3(level.quantity - delta);
    throw conflict(
      `Insufficient stock for ${product?.sku ?? 'product'} ${product?.name ?? ''}: available ${available}, required ${Math.abs(delta)}`.trim(),
    );
  }

  await tx.insert(stockMovements).values({
    productId: input.productId,
    warehouseId: input.warehouseId,
    type: input.type,
    quantity: delta,
    balanceAfter: level.quantity,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    referenceNumber: input.referenceNumber,
    note: input.note ?? null,
    createdBy: input.userId,
  });

  return level.quantity;
}
