import { Router } from 'express';
import { parse, uuidParam } from '../../lib/http.js';
import { PERMISSIONS } from '../../lib/permissions.js';
import { currentUser, requirePermission } from '../../middleware/auth.js';
import * as purchase from './purchase.service.js';

const canView = requirePermission(PERMISSIONS.PURCHASE_VIEW);
const canManage = requirePermission(PERMISSIONS.PURCHASE_MANAGE);
const canApprove = requirePermission(PERMISSIONS.PURCHASE_APPROVE);

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.get('/', canView, async (req, res) => {
  res.json(await purchase.listPurchaseOrders(parse(purchase.purchaseOrderListQuery, req.query)));
});

purchaseOrdersRouter.get('/:id', canView, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  res.json(await purchase.getPurchaseOrder(id));
});

purchaseOrdersRouter.post('/', canManage, async (req, res) => {
  const input = parse(purchase.purchaseOrderSchema, req.body);
  res.status(201).json(await purchase.createPurchaseOrder(input, currentUser(req).id));
});

purchaseOrdersRouter.put('/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await purchase.updatePurchaseOrder(id, parse(purchase.purchaseOrderSchema, req.body));
  res.status(204).end();
});

purchaseOrdersRouter.delete('/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await purchase.deletePurchaseOrder(id);
  res.status(204).end();
});

purchaseOrdersRouter.post('/:id/approve', canApprove, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await purchase.approvePurchaseOrder(id);
  res.status(204).end();
});

purchaseOrdersRouter.post('/:id/receive', canApprove, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await purchase.receivePurchaseOrder(id, currentUser(req).id);
  res.status(204).end();
});

purchaseOrdersRouter.post('/:id/cancel', canApprove, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await purchase.cancelPurchaseOrder(id);
  res.status(204).end();
});
