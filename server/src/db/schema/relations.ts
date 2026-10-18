import { relations } from 'drizzle-orm';
import { refreshTokens, roles, users } from './auth.js';
import { categories, products, stockLevels, stockMovements, warehouses } from './inventory.js';
import { customers, suppliers } from './parties.js';
import { purchaseOrderLines, purchaseOrders } from './purchase.js';
import { salesOrderLines, salesOrders } from './sales.js';

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  stockLevels: many(stockLevels),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  stockLevels: many(stockLevels),
}));

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  product: one(products, { fields: [stockLevels.productId], references: [products.id] }),
  warehouse: one(warehouses, { fields: [stockLevels.warehouseId], references: [warehouses.id] }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, { fields: [stockMovements.productId], references: [products.id] }),
  warehouse: one(warehouses, { fields: [stockMovements.warehouseId], references: [warehouses.id] }),
  user: one(users, { fields: [stockMovements.createdBy], references: [users.id] }),
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  customer: one(customers, { fields: [salesOrders.customerId], references: [customers.id] }),
  warehouse: one(warehouses, { fields: [salesOrders.warehouseId], references: [warehouses.id] }),
  creator: one(users, { fields: [salesOrders.createdBy], references: [users.id] }),
  lines: many(salesOrderLines),
}));

export const salesOrderLinesRelations = relations(salesOrderLines, ({ one }) => ({
  order: one(salesOrders, { fields: [salesOrderLines.orderId], references: [salesOrders.id] }),
  product: one(products, { fields: [salesOrderLines.productId], references: [products.id] }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
  warehouse: one(warehouses, { fields: [purchaseOrders.warehouseId], references: [warehouses.id] }),
  creator: one(users, { fields: [purchaseOrders.createdBy], references: [users.id] }),
  lines: many(purchaseOrderLines),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one }) => ({
  order: one(purchaseOrders, { fields: [purchaseOrderLines.orderId], references: [purchaseOrders.id] }),
  product: one(products, { fields: [purchaseOrderLines.productId], references: [products.id] }),
}));
