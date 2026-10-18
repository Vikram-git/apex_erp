import { Router } from 'express';
import { parse, uuidParam } from '../../lib/http.js';
import { PERMISSIONS } from '../../lib/permissions.js';
import { currentUser, requirePermission } from '../../middleware/auth.js';
import * as sales from './sales.service.js';

const canView = requirePermission(PERMISSIONS.SALES_VIEW);
const canManage = requirePermission(PERMISSIONS.SALES_MANAGE);
const canApprove = requirePermission(PERMISSIONS.SALES_APPROVE);

export const salesOrdersRouter = Router();

salesOrdersRouter.get('/', canView, async (req, res) => {
  res.json(await sales.listSalesOrders(parse(sales.salesOrderListQuery, req.query)));
});

salesOrdersRouter.get('/:id', canView, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  res.json(await sales.getSalesOrder(id));
});

salesOrdersRouter.post('/', canManage, async (req, res) => {
  const input = parse(sales.salesOrderSchema, req.body);
  res.status(201).json(await sales.createSalesOrder(input, currentUser(req).id));
});

salesOrdersRouter.put('/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await sales.updateSalesOrder(id, parse(sales.salesOrderSchema, req.body));
  res.status(204).end();
});

salesOrdersRouter.delete('/:id', canManage, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await sales.deleteSalesOrder(id);
  res.status(204).end();
});

salesOrdersRouter.post('/:id/confirm', canApprove, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await sales.confirmSalesOrder(id);
  res.status(204).end();
});

salesOrdersRouter.post('/:id/deliver', canApprove, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await sales.deliverSalesOrder(id, currentUser(req).id);
  res.status(204).end();
});

salesOrdersRouter.post('/:id/cancel', canApprove, async (req, res) => {
  const { id } = parse(uuidParam, req.params);
  await sales.cancelSalesOrder(id);
  res.status(204).end();
});
