import { sql } from 'drizzle-orm';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { db } from './db/index.js';
import { logger } from './lib/logger.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { customersRouter, suppliersRouter } from './modules/parties/parties.routes.js';
import { purchaseOrdersRouter } from './modules/purchase/purchase.routes.js';
import { salesOrdersRouter } from './modules/sales/sales.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.get('/api/health', async (_req, res) => {
    await db.execute(sql`select 1`);
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);

  const api = Router();
  api.use(authenticate);
  api.use('/dashboard', dashboardRouter);
  api.use('/admin', usersRouter);
  api.use('/inventory', inventoryRouter);
  api.use('/customers', customersRouter);
  api.use('/suppliers', suppliersRouter);
  api.use('/sales-orders', salesOrdersRouter);
  api.use('/purchase-orders', purchaseOrdersRouter);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
