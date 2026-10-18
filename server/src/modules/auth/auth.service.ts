import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { refreshTokens, roles, users } from '../../db/schema/index.js';
import { badRequest, unauthorized } from '../../lib/errors.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../../lib/tokens.js';

const BCRYPT_ROUNDS = 12;
const REUSE_GRACE_MS = 10_000;
// Equalises response time for unknown emails to prevent account enumeration
const DUMMY_HASH = bcrypt.hashSync('timing-safe-placeholder', BCRYPT_ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

interface ClientInfo {
  userAgent?: string;
  ipAddress?: string;
}

async function loadUserWithRole(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      isActive: users.isActive,
      roleName: roles.name,
      permissions: roles.permissions,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(users.id, userId));
  return row;
}

type UserWithRole = NonNullable<Awaited<ReturnType<typeof loadUserWithRole>>>;

function toProfile(user: UserWithRole) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.roleName,
    permissions: user.permissions,
  };
}

async function issueSession(user: UserWithRole, client: ClientInfo) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    userAgent: client.userAgent?.slice(0, 255),
    ipAddress: client.ipAddress?.slice(0, 64),
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    name: user.fullName,
    role: user.roleName,
    permissions: user.permissions,
  });

  return { accessToken, refreshToken, refreshExpiresAt: expiresAt, user: toProfile(user) };
}

export async function login(email: string, password: string, client: ClientInfo) {
  const [account] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  const valid = await bcrypt.compare(password, account?.passwordHash ?? DUMMY_HASH);
  if (!account || !valid) throw unauthorized('Invalid email or password');
  if (!account.isActive) throw unauthorized('Your account has been deactivated');

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, account.id));

  const user = await loadUserWithRole(account.id);
  if (!user) throw unauthorized('Invalid email or password');
  return issueSession(user, client);
}

export async function refresh(presentedToken: string, client: ClientInfo) {
  const tokenHash = hashToken(presentedToken);
  const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));

  if (!stored) throw unauthorized('Session expired');

  if (stored.revokedAt) {
    // Concurrent refreshes (e.g. two tabs) can legitimately race right after rotation
    if (Date.now() - stored.revokedAt.getTime() < REUSE_GRACE_MS) throw unauthorized('Session expired');

    // A rotated token was replayed later: assume theft and terminate every session for this user
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, stored.userId), isNull(refreshTokens.revokedAt)));
    throw unauthorized('Session expired');
  }

  if (stored.expiresAt < new Date()) throw unauthorized('Session expired');

  const user = await loadUserWithRole(stored.userId);
  if (!user?.isActive) throw unauthorized('Your account has been deactivated');

  const revoked = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, stored.id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  if (revoked.length === 0) throw unauthorized('Session expired');

  return issueSession(user, client);
}

export async function logout(presentedToken: string | undefined) {
  if (!presentedToken) return;
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, hashToken(presentedToken)), isNull(refreshTokens.revokedAt)));
}

export async function getProfile(userId: string) {
  const user = await loadUserWithRole(userId);
  if (!user?.isActive) throw unauthorized();
  return toProfile(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const [account] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!account) throw unauthorized();

  if (!(await bcrypt.compare(currentPassword, account.passwordHash))) {
    throw badRequest('Current password is incorrect');
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId));
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  });
}
