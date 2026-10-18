import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, type Transaction } from '../../db/index.js';
import {
  products,
  purchaseOrderLines,
  purchaseOrders,
  stockLevels,
  suppliers,
  users,
  warehouses,
} from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { likePattern, offsetOf, paginate } from '../../lib/http.js';
import { computeDocumentTotals, round2 } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/sequences.js';
import { applyStockMovement } from '../inventory/stock.service.js';
import { assertOrderReferences, orderBaseSchema, orderListQuery } from '../shared/order-validation.js';

export const purchaseOrderSchema = orderBaseSchema.safeExtend({ supplierId: z.uuid() });
export const purchaseOrderListQuery = orderListQuery.extend({
  status: z.enum(purchaseOrders.status.enumValues).optional(),
});

type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
type PurchaseOrderStatus = (typeof purchaseOrders.status.enumValues)[number];

export async function listPurchaseOrders(query: z.infer<typeof purchaseOrderListQuery>) {
  const filters: (SQL | undefined)[] = [
    query.status ? eq(purchaseOrders.status, query.status) : undefined,
    query.partyId ? eq(purchaseOrders.supplierId, query.partyId) : undefined,
    query.from ? gte(purchaseOrders.orderDate, query.from) : undefined,
    query.to ? lte(purchaseOrders.orderDate, query.to) : undefined,
    query.search
      ? or(ilike(purchaseOrders.orderNumber, likePattern(query.search)), ilike(suppliers.name, likePattern(query.search)))
      : undefined,
  ];
  const where = and(...filters);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        orderNumber: purchaseOrders.orderNumber,
        status: purchaseOrders.status,
        orderDate: purchaseOrders.orderDate,
        expectedDate: purchaseOrders.expectedDate,
        total: purchaseOrders.total,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        warehouseCode: warehouses.code,
        createdAt: purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .innerJoin(warehouses, eq(warehouses.id, purchaseOrders.warehouseId))
      .where(where)
      .orderBy(desc(purchaseOrders.orderDate), desc(purchaseOrders.orderNumber))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db
      .select({ total: count() })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(where),
  ]);

  return paginate(rows, totalRow?.total ?? 0, query);
}

export async function getPurchaseOrder(id: string) {
  const [order] = await db
    .select({
      order: purchaseOrders,
      supplier: { id: suppliers.id, code: suppliers.code, name: suppliers.name, address: suppliers.address, taxId: suppliers.taxId },
      warehouse: { id: warehouses.id, code: warehouses.code, name: warehouses.name },
      createdByName: users.fullName,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .innerJoin(warehouses, eq(warehouses.id, purchaseOrders.warehouseId))
    .leftJoin(users, eq(users.id, purchaseOrders.createdBy))
    .where(eq(purchaseOrders.id, id));
  if (!order) throw notFound('Purchase order');

  const lines = await db
    .select({
      id: purchaseOrderLines.id,
      lineNo: purchaseOrderLines.lineNo,
      productId: purchaseOrderLines.productId,
      sku: products.sku,
      productName: products.name,
      uom: products.uom,
      quantity: purchaseOrderLines.quantity,
      unitPrice: purchaseOrderLines.unitPrice,
      taxRate: purchaseOrderLines.taxRate,
      lineSubtotal: purchaseOrderLines.lineSubtotal,
      lineTax: purchaseOrderLines.lineTax,
      lineTotal: purchaseOrderLines.lineTotal,
    })
    .from(purchaseOrderLines)
    .innerJoin(products, eq(products.id, purchaseOrderLines.productId))
    .where(eq(purchaseOrderLines.orderId, id))
    .orderBy(asc(purchaseOrderLines.lineNo));

  return { ...order.order, supplier: order.supplier, warehouse: order.warehouse, createdByName: order.createdByName, lines };
}

async function assertSupplierActive(tx: Transaction, supplierId: string) {
  const [supplier] = await tx.select({ isActive: suppliers.isActive }).from(suppliers).where(eq(suppliers.id, supplierId));
  if (!supplier) throw notFound('Supplier');
  if (!supplier.isActive) throw badRequest('Supplier is inactive');
}

async function lockOrder(tx: Transaction, id: string) {
  const [order] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).for('update');
  if (!order) throw notFound('Purchase order');
  return order;
}

function assertStatus(current: PurchaseOrderStatus, allowed: PurchaseOrderStatus[], action: string) {
  if (!allowed.includes(current)) {
    throw conflict(`Cannot ${action} an order that is ${current}`);
  }
}

async function writeLines(tx: Transaction, orderId: string, input: PurchaseOrderInput) {
  const totals = computeDocumentTotals(input.lines);
  await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.orderId, orderId));
  await tx.insert(purchaseOrderLines).values(totals.lines.map((line) => ({ ...line, orderId })));
  return totals;
}

/** Weighted moving average: blends existing on-hand value with the incoming receipt. */
async function updateMovingAverageCost(tx: Transaction, productId: string, receivedQty: number, unitCost: number) {
  const [product] = await tx
    .select({ costPrice: products.costPrice })
    .from(products)
    .where(eq(products.id, productId))
    .for('update');
  if (!product) return;

  const [onHandRow] = await tx
    .select({ onHand: sql<number>`coalesce(sum(${stockLevels.quantity}), 0)`.mapWith(Number) })
    .from(stockLevels)
    .where(eq(stockLevels.productId, productId));
  const onHand = Math.max(onHandRow?.onHand ?? 0, 0);

  const newCost =
    onHand + receivedQty > 0 ? round2((onHand * product.costPrice + receivedQty * unitCost) / (onHand + receivedQty)) : unitCost;

  await tx.update(products).set({ costPrice: newCost }).where(eq(products.id, productId));
}

export async function createPurchaseOrder(input: PurchaseOrderInput, userId: string) {
  return db.transaction(async (tx) => {
    await assertSupplierActive(tx, input.supplierId);
    await assertOrderReferences(tx, input.warehouseId, input.lines.map((l) => l.productId));

    const orderNumber = await nextDocumentNumber(tx, 'PO');
    const [order] = await tx
      .insert(purchaseOrders)
      .values({
        orderNumber,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        orderDate: input.orderDate,
        expectedDate: input.expectedDate ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
      })
      .returning({ id: purchaseOrders.id });
    if (!order) throw new Error('Failed to create purchase order');

    const totals = await writeLines(tx, order.id, input);
    await tx
      .update(purchaseOrders)
      .set({ subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total })
      .where(eq(purchaseOrders.id, order.id));

    return { id: order.id, orderNumber };
  });
}

export async function updatePurchaseOrder(id: string, input: PurchaseOrderInput) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['draft'], 'edit');
    await assertSupplierActive(tx, input.supplierId);
    await assertOrderReferences(tx, input.warehouseId, input.lines.map((l) => l.productId));

    const totals = await writeLines(tx, id, input);
    await tx
      .update(purchaseOrders)
      .set({
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        orderDate: input.orderDate,
        expectedDate: input.expectedDate ?? null,
        notes: input.notes ?? null,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
      })
      .where(eq(purchaseOrders.id, id));
  });
}

export async function approvePurchaseOrder(id: string) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['draft'], 'approve');
    await assertSupplierActive(tx, order.supplierId);
    await tx.update(purchaseOrders).set({ status: 'approved', approvedAt: new Date() }).where(eq(purchaseOrders.id, id));
  });
}

export async function receivePurchaseOrder(id: string, userId: string) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['approved'], 'receive');

    const lines = await tx
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.orderId, id))
      .orderBy(asc(purchaseOrderLines.lineNo));

    for (const line of lines) {
      await updateMovingAverageCost(tx, line.productId, line.quantity, line.unitPrice);
      await applyStockMovement(tx, {
        productId: line.productId,
        warehouseId: order.warehouseId,
        quantity: line.quantity,
        type: 'purchase_receipt',
        referenceType: 'purchase_order',
        referenceId: order.id,
        referenceNumber: order.orderNumber,
        userId,
      });
    }

    await tx.update(purchaseOrders).set({ status: 'received', receivedAt: new Date() }).where(eq(purchaseOrders.id, id));
  });
}

export async function cancelPurchaseOrder(id: string) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['draft', 'approved'], 'cancel');
    await tx.update(purchaseOrders).set({ status: 'cancelled', cancelledAt: new Date() }).where(eq(purchaseOrders.id, id));
  });
}

export async function deletePurchaseOrder(id: string) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['draft'], 'delete');
    await tx.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
  });
}
