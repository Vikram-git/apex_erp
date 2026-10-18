import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { hasPermission } from '../lib/permissions.js';
import { verifyAccessToken } from '../lib/tokens.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized();
  }

  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      permissions: payload.permissions,
    };
  } catch {
    throw unauthorized('Session expired or invalid');
  }
  next();
}

/** Requires that the user holds at least one of the given permissions. */
export function requirePermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const granted = req.user?.permissions ?? [];
    if (!required.some((p) => hasPermission(granted, p))) {
      throw forbidden();
    }
    next();
  };
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
