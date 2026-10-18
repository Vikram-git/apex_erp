import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../../db/index.js';
import { customers, products, purchaseOrders, salesOrders, stockLevels, suppliers } from '../../db/schema/index.js';
import { PERMISSIONS } from '../../lib/permissions.js';
import { requirePermission } from '../../middleware/auth.js';

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

export const dashboardRouter = Router();

dashboardRouter.get('/summary', requirePermission(PERMISSIONS.DASHBOARD_VIEW), async (_req, res) => {
  const now = new Date();
  const monthStart = toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
  const trendStart = toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1)));

  const onHand = db
    .select({
      productId: stockLevels.productId,
      quantity: sql<number>`sum(${stockLevels.quantity})`.as('quantity'),
    })
    .from(stockLevels)
    .groupBy(stockLevels.productId)
    .as('on_hand');

  const [activeProducts, activeCustomers, activeSuppliers, openSalesOrders, openPurchaseOrders] = await Promise.all([
    db.$count(products, eq(products.isActive, true)),
    db.$count(customers, eq(customers.isActive, true)),
    db.$count(suppliers, eq(suppliers.isActive, true)),
    db.$count(salesOrders, inArray(salesOrders.status, ['draft', 'confirmed'])),
    db.$count(purchaseOrders, inArray(purchaseOrders.status, ['draft', 'approved'])),
  ]);

  const [
    [salesMonth],
    [purchaseMonth],
    [inventory],
    lowStock,
    salesTrend,
    purchaseTrend,
    recentSales,
  ] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${salesOrders.total}), 0)`.mapWith(Number) })
      .from(salesOrders)
      .where(and(inArray(salesOrders.status, ['confirmed', 'delivered']), gte(salesOrders.orderDate, monthStart))),
    db
      .select({ total: sql<number>`coalesce(sum(${purchaseOrders.total}), 0)`.mapWith(Number) })
      .from(purchaseOrders)
      .where(and(inArray(purchaseOrders.status, ['approved', 'received']), gte(purchaseOrders.orderDate, monthStart))),
    db
      .select({ value: sql<number>`coalesce(sum(${stockLevels.quantity} * ${products.costPrice}), 0)`.mapWith(Number) })
      .from(stockLevels)
      .innerJoin(products, eq(products.id, stockLevels.productId)),
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        uom: products.uom,
        reorderLevel: products.reorderLevel,
        onHand: sql<number>`coalesce(${onHand.quantity}, 0)`.mapWith(Number),
      })
      .from(products)
      .leftJoin(onHand, eq(onHand.productId, products.id))
      .where(
        and(
          eq(products.isActive, true),
          sql`${products.reorderLevel} > 0`,
          sql`coalesce(${onHand.quantity}, 0) <= ${products.reorderLevel}`,
        ),
      )
      .orderBy(sql`coalesce(${onHand.quantity}, 0) - ${products.reorderLevel}`)
      .limit(10),
    db
      .select({
        month: sql<string>`to_char(${salesOrders.orderDate}, 'YYYY-MM')`,
        total: sql<number>`sum(${salesOrders.total})`.mapWith(Number),
      })
      .from(salesOrders)
      .where(and(inArray(salesOrders.status, ['confirmed', 'delivered']), gte(salesOrders.orderDate, trendStart)))
      .groupBy(sql`1`),
    db
      .select({
        month: sql<string>`to_char(${purchaseOrders.orderDate}, 'YYYY-MM')`,
        total: sql<number>`sum(${purchaseOrders.total})`.mapWith(Number),
      })
      .from(purchaseOrders)
      .where(and(inArray(purchaseOrders.status, ['approved', 'received']), gte(purchaseOrders.orderDate, trendStart)))
      .groupBy(sql`1`),
    db
      .select({
        id: salesOrders.id,
        orderNumber: salesOrders.orderNumber,
        customerName: customers.name,
        status: salesOrders.status,
        orderDate: salesOrders.orderDate,
        total: salesOrders.total,
      })
      .from(salesOrders)
      .innerJoin(customers, eq(customers.id, salesOrders.customerId))
      .orderBy(desc(salesOrders.createdAt))
      .limit(6),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5 + i, 1));
    return toIsoDate(d).slice(0, 7);
  });
  const trend = months.map((month) => ({
    month,
    sales: salesTrend.find((r) => r.month === month)?.total ?? 0,
    purchases: purchaseTrend.find((r) => r.month === month)?.total ?? 0,
  }));

  res.json({
    counts: {
      products: activeProducts,
      customers: activeCustomers,
      suppliers: activeSuppliers,
      openSalesOrders,
      openPurchaseOrders,
    },
    salesThisMonth: salesMonth?.total ?? 0,
    purchasesThisMonth: purchaseMonth?.total ?? 0,
    inventoryValue: inventory?.value ?? 0,
    lowStock,
    trend,
    recentSales,
  });
});
