import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { customers, suppliers } from '../../db/schema/index.js';
import { notFound } from '../../lib/errors.js';
import { booleanQuery, likePattern, listQuerySchema, offsetOf, optionalText, paginate, parse, uuidParam } from '../../lib/http.js';
import { PERMISSIONS } from '../../lib/permissions.js';
import { nextMasterCode } from '../../lib/sequences.js';
import { requirePermission } from '../../middleware/auth.js';

const partySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .max(20)
    .regex(/^[A-Z0-9._-]*$/, 'Code may contain only letters, digits, dot, dash and underscore')
    .optional(),
  name: z.string().trim().min(2).max(200),
  contactPerson: optionalText(150),
  email: z
    .union([z.email().trim().toLowerCase(), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  phone: optionalText(30),
  taxId: optionalText(30),
  address: optionalText(1000),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  isActive: z.boolean().default(true),
});

const customerSchema = partySchema.extend({ creditLimit: z.number().min(0).max(1e12).default(0) });

const partyListQuery = listQuerySchema.extend({ isActive: booleanQuery });

type PartyTable = typeof customers | typeof suppliers;

function buildWhere(table: PartyTable, query: z.infer<typeof partyListQuery>) {
  const filters: (SQL | undefined)[] = [
    query.isActive !== undefined ? eq(table.isActive, query.isActive) : undefined,
    query.search
      ? or(
          ilike(table.name, likePattern(query.search)),
          ilike(table.code, likePattern(query.search)),
          ilike(table.email, likePattern(query.search)),
        )
      : undefined,
  ];
  return and(...filters);
}

/* ---------- Customers ---------- */

export const customersRouter = Router();
const canViewSales = requirePermission(PERMISSIONS.SALES_VIEW);
const canManageSales = requirePermission(PERMISSIONS.SALES_MANAGE);

customersRouter.get('/', canViewSales, async (req, res) => {
  const query = parse(partyListQuery, req.query);
  const where = buildWhere(customers, query);
  const [rows, [totalRow]] = await Promise.all([
    db.select().from(customers).where(where).orderBy(asc(customers.name)).limit(query.pageSize).offset(offsetOf(query)),
    db.select({ total: count() }).from(customers).where(where),
  ]);
  res.json(paginate(rows, totalRow?.total ?? 0, query));
});

customersRouter.get('/:id', canViewSales, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const [row] = await db.select().from(customers).where(eq(customers.id, id));
  if (!row) throw notFound('Customer');
  res.json(row);
});

customersRouter.post('/', canManageSales, async (req, res) => {
  const input = parse(customerSchema, req.body);
  const created = await db.transaction(async (tx) => {
    const code = input.code || (await nextMasterCode(tx, 'CUS'));
    const [row] = await tx.insert(customers).values({ ...input, code }).returning();
    return row;
  });
  res.status(201).json(created);
});

customersRouter.put('/:id', canManageSales, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const { code, ...input } = parse(customerSchema, req.body);
  const [updated] = await db
    .update(customers)
    .set({ ...input, ...(code ? { code } : {}) })
    .where(eq(customers.id, id))
    .returning();
  if (!updated) throw notFound('Customer');
  res.json(updated);
});

customersRouter.delete('/:id', canManageSales, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const deleted = await db.delete(customers).where(eq(customers.id, id)).returning({ id: customers.id });
  if (deleted.length === 0) throw notFound('Customer');
  res.status(204).end();
});

/* ---------- Suppliers ---------- */

export const suppliersRouter = Router();
const canViewPurchase = requirePermission(PERMISSIONS.PURCHASE_VIEW);
const canManagePurchase = requirePermission(PERMISSIONS.PURCHASE_MANAGE);

suppliersRouter.get('/', canViewPurchase, async (req, res) => {
  const query = parse(partyListQuery, req.query);
  const where = buildWhere(suppliers, query);
  const [rows, [totalRow]] = await Promise.all([
    db.select().from(suppliers).where(where).orderBy(asc(suppliers.name)).limit(query.pageSize).offset(offsetOf(query)),
    db.select({ total: count() }).from(suppliers).where(where),
  ]);
  res.json(paginate(rows, totalRow?.total ?? 0, query));
});

suppliersRouter.get('/:id', canViewPurchase, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  if (!row) throw notFound('Supplier');
  res.json(row);
});

suppliersRouter.post('/', canManagePurchase, async (req, res) => {
  const input = parse(partySchema, req.body);
  const created = await db.transaction(async (tx) => {
    const code = input.code || (await nextMasterCode(tx, 'SUP'));
    const [row] = await tx.insert(suppliers).values({ ...input, code }).returning();
    return row;
  });
  res.status(201).json(created);
});

suppliersRouter.put('/:id', canManagePurchase, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const { code, ...input } = parse(partySchema, req.body);
  const [updated] = await db
    .update(suppliers)
    .set({ ...input, ...(code ? { code } : {}) })
    .where(eq(suppliers.id, id))
    .returning();
  if (!updated) throw notFound('Supplier');
  res.json(updated);
});

suppliersRouter.delete('/:id', canManagePurchase, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const deleted = await db.delete(suppliers).where(eq(suppliers.id, id)).returning({ id: suppliers.id });
  if (deleted.length === 0) throw notFound('Supplier');
  res.status(204).end();
});
