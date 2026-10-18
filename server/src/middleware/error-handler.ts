import type { NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

interface PgError {
  code: string;
  detail?: string;
  constraint?: string;
}

function extractPgError(err: unknown): PgError | null {
  // Drizzle wraps driver errors; the original pg error is on `cause`
  for (let current: unknown = err, depth = 0; current && depth < 3; depth++) {
    if (typeof current === 'object' && 'code' in current && typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) {
      return current as PgError;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
    return;
  }

  const pgError = extractPgError(err);
  if (pgError?.code === '23505') {
    res.status(409).json({
      error: { code: 'DUPLICATE', message: 'A record with the same unique value already exists', details: pgError.detail },
    });
    return;
  }
  if (pgError?.code === '23503') {
    res.status(409).json({
      error: {
        code: 'REFERENCED',
        message: 'This record is linked to other records and cannot be changed or removed',
        details: pgError.detail,
      },
    });
    return;
  }

  logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      ...(isProduction ? {} : { details: err instanceof Error ? err.message : String(err) }),
    },
  });
}
