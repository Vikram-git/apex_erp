import { and, asc, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { refreshTokens, roles, users } from '../../db/schema/index.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import {
  likePattern,
  listQuerySchema,
  offsetOf,
  optionalText,
  paginate,
  parse,
  passwordPolicy,
  uuidParam,
} from '../../lib/http.js';
import { ASSIGNABLE_PERMISSIONS, PERMISSION_CATALOG, PERMISSIONS } from '../../lib/permissions.js';
import { currentUser, requirePermission } from '../../middleware/auth.js';
import { hashPassword } from '../auth/auth.service.js';

const createUserSchema = z.object({
  email: z.email().trim().toLowerCase(),
  fullName: z.string().trim().min(2).max(150),
  roleId: z.uuid(),
  password: passwordPolicy,
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(150).optional(),
  roleId: z.uuid().optional(),
  isActive: z.boolean().optional(),
  password: passwordPolicy.optional(),
});

const roleSchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: optionalText(255),
  permissions: z
    .array(z.string())
    .refine((list) => list.every((p) => ASSIGNABLE_PERMISSIONS.has(p)), 'Unknown permission')
    .transform((list) => [...new Set(list)]),
});

const userColumns = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  roleId: users.roleId,
  roleName: roles.name,
};

export const usersRouter = Router();
usersRouter.use(requirePermission(PERMISSIONS.USERS_MANAGE));

usersRouter.get('/users', async (req, res) => {
  const query = parse(listQuerySchema, req.query);
  const where = query.search
    ? or(ilike(users.fullName, likePattern(query.search)), ilike(users.email, likePattern(query.search)))
    : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(userColumns)
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(where)
      .orderBy(asc(users.fullName))
      .limit(query.pageSize)
      .offset(offsetOf(query)),
    db.select({ total: count() }).from(users).where(where),
  ]);

  res.json(paginate(rows, totalRow?.total ?? 0, query));
});

usersRouter.post('/users', async (req, res) => {
  const input = parse(createUserSchema, req.body);
  const { password, ...rest } = input;
  const [created] = await db
    .insert(users)
    .values({ ...rest, passwordHash: await hashPassword(password) })
    .returning({ id: users.id });
  res.status(201).json(created);
});

usersRouter.patch('/users/:id', async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const input = parse(updateUserSchema, req.body);

  if (id === currentUser(req).id) {
    const [self] = await db.select({ roleId: users.roleId }).from(users).where(eq(users.id, id));
    if (input.isActive === false || (input.roleId && input.roleId !== self?.roleId)) {
      throw badRequest('You cannot deactivate yourself or change your own role');
    }
  }

  const { password, ...rest } = input;
  const values = { ...rest, ...(password ? { passwordHash: await hashPassword(password) } : {}) };
  if (Object.keys(values).length === 0) throw badRequest('Nothing to update');

  await db.transaction(async (tx) => {
    const updated = await tx.update(users).set(values).where(eq(users.id, id)).returning({ id: users.id });
    if (updated.length === 0) throw notFound('User');

    if (password || input.isActive === false) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, id), isNull(refreshTokens.revokedAt)));
    }
  });

  res.status(204).end();
});

usersRouter.get('/roles', async (_req, res) => {
  const rows = await db
    .select({
      id: roles.id,
      name: roles.name,
      description: roles.description,
      permissions: roles.permissions,
      isSystem: roles.isSystem,
      userCount: db.$count(users, eq(users.roleId, roles.id)),
    })
    .from(roles)
    .orderBy(desc(roles.isSystem), asc(roles.name));
  res.json(rows);
});

usersRouter.get('/roles/permissions', (_req, res) => {
  res.json(PERMISSION_CATALOG);
});

usersRouter.post('/roles', async (req, res) => {
  const input = parse(roleSchema, req.body);
  const [created] = await db.insert(roles).values(input).returning({ id: roles.id });
  res.status(201).json(created);
});

usersRouter.put('/roles/:id', async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const input = parse(roleSchema, req.body);

  const [existing] = await db.select().from(roles).where(eq(roles.id, id));
  if (!existing) throw notFound('Role');
  if (existing.isSystem && existing.name !== input.name) {
    throw badRequest('System roles cannot be renamed');
  }
  if (existing.isSystem && existing.permissions.includes(PERMISSIONS.ALL) && !input.permissions.includes(PERMISSIONS.ALL)) {
    throw badRequest('The administrator role must keep full access');
  }

  await db.update(roles).set(input).where(eq(roles.id, id));
  res.status(204).end();
});

usersRouter.delete('/roles/:id', async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  const [existing] = await db.select().from(roles).where(eq(roles.id, id));
  if (!existing) throw notFound('Role');
  if (existing.isSystem) throw badRequest('System roles cannot be deleted');

  const inUse = await db.$count(users, eq(users.roleId, id));
  if (inUse > 0) throw conflict('Role is assigned to users. Reassign them first.');

  await db.delete(roles).where(eq(roles.id, id));
  res.status(204).end();
});
