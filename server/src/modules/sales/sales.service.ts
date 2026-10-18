import { and, asc, count, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, type Transaction } from '../../db/index.js';
import { customers, products, salesOrderLines, salesOrders, users, warehouses } from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { likePattern, offsetOf, paginate } from '../../lib/http.js';
import { computeDocumentTotals } from '../../lib/money.js';
import { nextDocumentNumber } from '../../lib/sequences.js';
import { applyStockMovement } from '../inventory/stock.service.js';
import { assertOrderReferences, orderBaseSchema, orderListQuery } from '../shared/order-validation.js';

export const salesOrderSchema = orderBaseSchema.safeExtend({ customerId: z.uuid() });
export const salesOrderListQuery = orderListQuery.extend({
  status: z.enum(salesOrders.status.enumValues).optional(),
});

type SalesOrderInput = z.infer<typeof salesOrderSchema>;
type SalesOrderStatus = (typeof salesOrders.status.enumValues)[number];

export async function listSalesOrders(query: z.infer<typeof salesOrderListQuery>) {
  const filters: (SQL | undefined)[] = [
    query.status ? eq(salesOrders.status, query.status) : undefined,
    query.partyId ? eq(salesOrders.customerId, query.partyId) : undefined,
    query.from ? gte(salesOrders.orderDate, query.from) : undefined,
    query.to ? lte(salesOrders.orderDate, query.to) : undefined,
    query.search
      ? or(ilike(salesOrders.orderNumber, likePattern(query.search)), ilike(customers.name, likePattern(query.search)))
      : undefined,
  ];
  const where = and(...filters);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: salesOrders.id,
        orderNumber: salesOrders.orderNumber,
        status: salesOrders.status,
        orderDate: salesOrders.orderDate,
        expectedDate: salesOrders.expectedDate,
        total: salesOrders.total,
        customerId: customers.id,
        customerName: customers.name,
        warehouseCode: warehouses.code,
        createdAt: salesOrders.createdAt,
      })
      .from(salesOrders)
      .innerJoin(customers, eq(customers.id, salesOrders.customerId))
      .innerJoin(warehouses, eq(warehouses.id, salesOrders.warehouseId))
      .where(where)
      .orderBy(desc(salesOrders.orderDate), desc(salesOrders.orderNumber))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db
      .select({ total: count() })
      .from(salesOrders)
      .innerJoin(customers, eq(customers.id, salesOrders.customerId))
      .where(where),
  ]);

  return paginate(rows, totalRow?.total ?? 0, query);
}

export async function getSalesOrder(id: string) {
  const [order] = await db
    .select({
      order: salesOrders,
      customer: { id: customers.id, code: customers.code, name: customers.name, address: customers.address, taxId: customers.taxId },
      warehouse: { id: warehouses.id, code: warehouses.code, name: warehouses.name },
      createdByName: users.fullName,
    })
    .from(salesOrders)
    .innerJoin(customers, eq(customers.id, salesOrders.customerId))
    .innerJoin(warehouses, eq(warehouses.id, salesOrders.warehouseId))
    .leftJoin(users, eq(users.id, salesOrders.createdBy))
    .where(eq(salesOrders.id, id));
  if (!order) throw notFound('Sales order');

  const lines = await db
    .select({
      id: salesOrderLines.id,
      lineNo: salesOrderLines.lineNo,
      productId: salesOrderLines.productId,
      sku: products.sku,
      productName: products.name,
      uom: products.uom,
      quantity: salesOrderLines.quantity,
      unitPrice: salesOrderLines.unitPrice,
      taxRate: salesOrderLines.taxRate,
      lineSubtotal: salesOrderLines.lineSubtotal,
      lineTax: salesOrderLines.lineTax,
      lineTotal: salesOrderLines.lineTotal,
    })
    .from(salesOrderLines)
    .innerJoin(products, eq(products.id, salesOrderLines.productId))
    .where(eq(salesOrderLines.orderId, id))
    .orderBy(asc(salesOrderLines.lineNo));

  return { ...order.order, customer: order.customer, warehouse: order.warehouse, createdByName: order.createdByName, lines };
}

async function assertCustomerActive(tx: Transaction, customerId: string) {
  const [customer] = await tx.select({ isActive: customers.isActive }).from(customers).where(eq(customers.id, customerId));
  if (!customer) throw notFound('Customer');
  if (!customer.isActive) throw badRequest('Customer is inactive');
}

async function lockOrder(tx: Transaction, id: string) {
  const [order] = await tx.select().from(salesOrders).where(eq(salesOrders.id, id)).for('update');
  if (!order) throw notFound('Sales order');
  return order;
}

function assertStatus(current: SalesOrderStatus, allowed: SalesOrderStatus[], action: string) {
  if (!allowed.includes(current)) {
    throw conflict(`Cannot ${action} an order that is ${current}`);
  }
}

async function writeLines(tx: Transaction, orderId: string, input: SalesOrderInput) {
  const totals = computeDocumentTotals(input.lines);
  await tx.delete(salesOrderLines).where(eq(salesOrderLines.orderId, orderId));
  await tx.insert(salesOrderLines).values(totals.lines.map((line) => ({ ...line, orderId })));
  return totals;
}

export async function createSalesOrder(input: SalesOrderInput, userId: string) {
  return db.transaction(async (tx) => {
    await assertCustomerActive(tx, input.customerId);
    await assertOrderReferences(tx, input.warehouseId, input.lines.map((l) => l.productId));

    const orderNumber = await nextDocumentNumber(tx, 'SO');
    const [order] = await tx
      .insert(salesOrders)
      .values({
        orderNumber,
        customerId: input.customerId,
        warehouseId: input.warehouseId,
        orderDate: input.orderDate,
        expectedDate: input.expectedDate ?? null,
        notes: input.notes ?? null,
        createdBy: userId,
      })
      .returning({ id: salesOrders.id });
    if (!order) throw new Error('Failed to create sales order');

    const totals = await writeLines(tx, order.id, input);
    await tx
      .update(salesOrders)
      .set({ subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total })
      .where(eq(salesOrders.id, order.id));

    return { id: order.id, orderNumber };
  });
}

export async function updateSalesOrder(id: string, input: SalesOrderInput) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['draft'], 'edit');
    await assertCustomerActive(tx, input.customerId);
    await assertOrderReferences(tx, input.warehouseId, input.lines.map((l) => l.productId));

    const totals = await writeLines(tx, id, input);
    await tx
      .update(salesOrders)
      .set({
        customerId: input.customerId,
        warehouseId: input.warehouseId,
        orderDate: input.orderDate,
        expectedDate: input.expectedDate ?? null,
        notes: input.notes ?? null,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
      })
      .where(eq(salesOrders.id, id));
  });
}

export async function confirmSalesOrder(id: string) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['draft'], 'confirm');
    await assertCustomerActive(tx, order.customerId);
    await tx.update(salesOrders).set({ status: 'confirmed', confirmedAt: new Date() }).where(eq(salesOrders.id, id));
  });
}

export async function deliverSalesOrder(id: string, userId: string) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['confirmed'], 'deliver');

    const lines = await tx
      .select()
      .from(salesOrderLines)
      .where(eq(salesOrderLines.orderId, id))
      .orderBy(asc(salesOrderLines.lineNo));

    for (const line of lines) {
      await applyStockMovement(tx, {
        productId: line.productId,
        warehouseId: order.warehouseId,
        quantity: -line.quantity,
        type: 'sales_delivery',
        referenceType: 'sales_order',
        referenceId: order.id,
        referenceNumber: order.orderNumber,
        userId,
      });
    }

    await tx.update(salesOrders).set({ status: 'delivered', deliveredAt: new Date() }).where(eq(salesOrders.id, id));
  });
}

export async function cancelSalesOrder(id: string) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['draft', 'confirmed'], 'cancel');
    await tx.update(salesOrders).set({ status: 'cancelled', cancelledAt: new Date() }).where(eq(salesOrders.id, id));
  });
}

export async function deleteSalesOrder(id: string) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    assertStatus(order.status, ['draft'], 'delete');
    await tx.delete(salesOrders).where(eq(salesOrders.id, id));
  });
}
