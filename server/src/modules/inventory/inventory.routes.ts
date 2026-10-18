import { and, asc, count, desc, eq, getTableColumns, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import {
  categories,
  products,
  productTypeEnum,
  stockLevels,
  stockMovements,
  stockMovementTypeEnum,
  users,
  warehouses,
} from '../../db/schema/index.js';
import { badRequest, notFound } from '../../lib/errors.js';
import {
  booleanQuery,
  likePattern,
  listQuerySchema,
  offsetOf,
  optionalText,
  paginate,
  parse,
  uuidParam,
} from '../../lib/http.js';
import { PERMISSIONS } from '../../lib/permissions.js';
import { currentUser, requirePermission } from '../../middleware/auth.js';
import { applyStockMovement } from './stock.service.js';

const canView = requirePermission(PERMISSIONS.INVENTORY_VIEW);
const canManage = requirePermission(PERMISSIONS.INVENTORY_MANAGE);
const canAdjust = requirePermission(PERMISSIONS.STOCK_ADJUST);

const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: optionalText(255),
});

const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9._-]+$/, 'SKU may contain only letters, digits, dot, dash and underscore'),
  name: z.string().trim().min(2).max(200),
  description: optionalText(2000),
  type: z.enum(productTypeEnum.enumValues),
  categoryId: z.uuid().nullish(),
  uom: z.string().trim().min(1).max(20),
  costPrice: z.number().min(0).max(1e10),
  salePrice: z.number().min(0).max(1e10),
  taxRate: z.number().min(0).max(100),
  reorderLevel: z.number().min(0).max(1e10),
  isActive: z.boolean().default(true),
});

const productListQuery = listQuerySchema.extend({
  type: z.enum(productTypeEnum.enumValues).optional(),
  categoryId: z.uuid().optional(),
  isActive: booleanQuery,
});

const warehouseSchema = z.object({
  code: z.string().trim().toUpperCase().min(2).max(20),
  name: z.string().trim().min(2).max(100),
  address: optionalText(500),
  isActive: z.boolean().default(true),
});

const stockLevelQuery = listQuerySchema.extend({
  warehouseId: z.uuid().optional(),
  lowStock: booleanQuery,
});

const movementQuery = listQuerySchema.extend({
  productId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  type: z.enum(stockMovementTypeEnum.enumValues).optional(),
});

const adjustmentSchema = z.object({
  productId: z.uuid(),
  warehouseId: z.uuid(),
  quantity: z
    .number()
    .refine((v) => v !== 0, 'Quantity cannot be zero')
    .refine((v) => Math.abs(v) <= 1e9, 'Quantity is too large'),
  note: z.string().trim().min(3, 'A reason is required').max(255),
});

const transferSchema = z
  .object({
    productId: z.uuid(),
    fromWarehouseId: z.uuid(),
    toWarehouseId: z.uuid(),
    quantity: z.number().positive().max(1e9),
    note: optionalText(255),
  })
  .refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
    message: 'Source and destination warehouses must differ',
    path: ['toWarehouseId'],
  });

const onHandSql = sql<number>`coalesce((select sum(${stockLevels.quantity}) from ${stockLevels} where ${stockLevels.productId} = ${products.id}), 0)`.mapWith(Number);

export const inventoryRouter = Router();

/* ---------- Categories ---------- */

inventoryRouter.get('/categories', canView, async (_req, res) => {
  const rows = await db
    .select({ ...getTableColumns(categories), productCount: db.$count(products, eq(products.categoryId, categories.id)) })
    .from(categories)
    .orderBy(asc(categories.name));
  res.json(rows);
});

inventoryRouter.post('/categories', canManage, async (req, res) => {
  const [created] = await db.insert(categories).values(parse(categorySchema, req.body)).returning();
  res.status(201).json(created);
});

inventoryRouter.put('/categories/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const [updated] = await db.update(categories).set(parse(categorySchema, req.body)).where(eq(categories.id, id)).returning();
  if (!updated) throw notFound('Category');
  res.json(updated);
});

inventoryRouter.delete('/categories/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const deleted = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
  if (deleted.length === 0) throw notFound('Category');
  res.status(204).end();
});

/* ---------- Products ---------- */

inventoryRouter.get('/products', canView, async (req, res) => {
  const query = parse(productListQuery, req.query);
  const filters: (SQL | undefined)[] = [
    query.type ? eq(products.type, query.type) : undefined,
    query.categoryId ? eq(products.categoryId, query.categoryId) : undefined,
    query.isActive !== undefined ? eq(products.isActive, query.isActive) : undefined,
    query.search
      ? or(ilike(products.name, likePattern(query.search)), ilike(products.sku, likePattern(query.search)))
      : undefined,
  ];
  const where = and(...filters);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({ ...getTableColumns(products), categoryName: categories.name, onHand: onHandSql })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(where)
      .orderBy(asc(products.sku))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db.select({ total: count() }).from(products).where(where),
  ]);

  res.json(paginate(rows, totalRow?.total ?? 0, query));
});

inventoryRouter.get('/products/:id', canView, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const [product] = await db
    .select({ ...getTableColumns(products), categoryName: categories.name, onHand: onHandSql })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id));
  if (!product) throw notFound('Product');

  const stock = await db
    .select({
      warehouseId: warehouses.id,
      warehouseCode: warehouses.code,
      warehouseName: warehouses.name,
      quantity: stockLevels.quantity,
    })
    .from(stockLevels)
    .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
    .where(eq(stockLevels.productId, id))
    .orderBy(asc(warehouses.code));

  res.json({ ...product, stock });
});

inventoryRouter.post('/products', canManage, async (req, res) => {
  const [created] = await db.insert(products).values(parse(productSchema, req.body)).returning();
  res.status(201).json(created);
});

inventoryRouter.put('/products/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const [updated] = await db.update(products).set(parse(productSchema, req.body)).where(eq(products.id, id)).returning();
  if (!updated) throw notFound('Product');
  res.json(updated);
});

inventoryRouter.delete('/products/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const deleted = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
  if (deleted.length === 0) throw notFound('Product');
  res.status(204).end();
});

/* ---------- Warehouses ---------- */

inventoryRouter.get('/warehouses', canView, async (_req, res) => {
  const rows = await db.select().from(warehouses).orderBy(asc(warehouses.code));
  res.json(rows);
});

inventoryRouter.post('/warehouses', canManage, async (req, res) => {
  const [created] = await db.insert(warehouses).values(parse(warehouseSchema, req.body)).returning();
  res.status(201).json(created);
});

inventoryRouter.put('/warehouses/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const [updated] = await db.update(warehouses).set(parse(warehouseSchema, req.body)).where(eq(warehouses.id, id)).returning();
  if (!updated) throw notFound('Warehouse');
  res.json(updated);
});

inventoryRouter.delete('/warehouses/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const deleted = await db.delete(warehouses).where(eq(warehouses.id, id)).returning({ id: warehouses.id });
  if (deleted.length === 0) throw notFound('Warehouse');
  res.status(204).end();
});

/* ---------- Stock ---------- */

inventoryRouter.get('/stock/levels', canView, async (req, res) => {
  const query = parse(stockLevelQuery, req.query);
  const filters: (SQL | undefined)[] = [
    query.warehouseId ? eq(stockLevels.warehouseId, query.warehouseId) : undefined,
    query.lowStock ? lte(stockLevels.quantity, products.reorderLevel) : undefined,
    query.search
      ? or(ilike(products.name, likePattern(query.search)), ilike(products.sku, likePattern(query.search)))
      : undefined,
  ];
  const where = and(...filters);

  const base = db
    .select({
      productId: products.id,
      sku: products.sku,
      productName: products.name,
      uom: products.uom,
      reorderLevel: products.reorderLevel,
      costPrice: products.costPrice,
      warehouseId: warehouses.id,
      warehouseCode: warehouses.code,
      warehouseName: warehouses.name,
      quantity: stockLevels.quantity,
      stockValue: sql<number>`round(${stockLevels.quantity} * ${products.costPrice}, 2)`.mapWith(Number),
      updatedAt: stockLevels.updatedAt,
    })
    .from(stockLevels)
    .innerJoin(products, eq(products.id, stockLevels.productId))
    .innerJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
    .where(where);

  const [rows, [totalRow]] = await Promise.all([
    base.orderBy(asc(products.sku), asc(warehouses.code)).limit(query.pageSize).offset(offsetOf(query)),
    db
      .select({ total: count() })
      .from(stockLevels)
      .innerJoin(products, eq(products.id, stockLevels.productId))
      .where(where),
  ]);

  res.json(paginate(rows, totalRow?.total ?? 0, query));
});

inventoryRouter.get('/stock/movements', canView, async (req, res) => {
  const query = parse(movementQuery, req.query);
  const filters: (SQL | undefined)[] = [
    query.productId ? eq(stockMovements.productId, query.productId) : undefined,
    query.warehouseId ? eq(stockMovements.warehouseId, query.warehouseId) : undefined,
    query.type ? eq(stockMovements.type, query.type) : undefined,
    query.search
      ? or(
          ilike(products.name, likePattern(query.search)),
          ilike(products.sku, likePattern(query.search)),
          ilike(stockMovements.referenceNumber, likePattern(query.search)),
        )
      : undefined,
  ];
  const where = and(...filters);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        ...getTableColumns(stockMovements),
        sku: products.sku,
        productName: products.name,
        uom: products.uom,
        warehouseCode: warehouses.code,
        userName: users.fullName,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
      .leftJoin(users, eq(users.id, stockMovements.createdBy))
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db
      .select({ total: count() })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .where(where),
  ]);

  res.json(paginate(rows, totalRow?.total ?? 0, query));
});

async function assertActive(productId: string, warehouseIds: string[]) {
  const [product] = await db.select({ isActive: products.isActive }).from(products).where(eq(products.id, productId));
  if (!product) throw notFound('Product');
  if (!product.isActive) throw badRequest('Product is inactive');

  for (const warehouseId of warehouseIds) {
    const [warehouse] = await db.select({ isActive: warehouses.isActive }).from(warehouses).where(eq(warehouses.id, warehouseId));
    if (!warehouse) throw notFound('Warehouse');
    if (!warehouse.isActive) throw badRequest('Warehouse is inactive');
  }
}

inventoryRouter.post('/stock/adjustments', canAdjust, async (req, res) => {
  const input = parse(adjustmentSchema, req.body);
  await assertActive(input.productId, [input.warehouseId]);

  const balance = await db.transaction((tx) =>
    applyStockMovement(tx, {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      type: 'adjustment',
      referenceType: 'adjustment',
      note: input.note,
      userId: currentUser(req).id,
    }),
  );

  res.status(201).json({ balance });
});

inventoryRouter.post('/stock/transfers', canAdjust, async (req, res) => {
  const input = parse(transferSchema, req.body);
  await assertActive(input.productId, [input.fromWarehouseId, input.toWarehouseId]);
  const userId = currentUser(req).id;

  await db.transaction(async (tx) => {
    await applyStockMovement(tx, {
      productId: input.productId,
      warehouseId: input.fromWarehouseId,
      quantity: -input.quantity,
      type: 'transfer_out',
      referenceType: 'transfer',
      note: input.note,
      userId,
    });
    await applyStockMovement(tx, {
      productId: input.productId,
      warehouseId: input.toWarehouseId,
      quantity: input.quantity,
      type: 'transfer_in',
      referenceType: 'transfer',
      note: input.note,
      userId,
    });
  });

  res.status(201).json({ ok: true });
});
