export const PERMISSIONS = {
  ALL: '*',
  DASHBOARD_VIEW: 'dashboard:view',
  USERS_MANAGE: 'users:manage',
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_MANAGE: 'inventory:manage',
  STOCK_ADJUST: 'stock:adjust',
  SALES_VIEW: 'sales:view',
  SALES_MANAGE: 'sales:manage',
  SALES_APPROVE: 'sales:approve',
  PURCHASE_VIEW: 'purchase:view',
  PURCHASE_MANAGE: 'purchase:manage',
  PURCHASE_APPROVE: 'purchase:approve',
} as const;

export function hasPermission(granted: readonly string[] | undefined, required: string): boolean {
  if (!granted) return false;
  return granted.includes(PERMISSIONS.ALL) || granted.includes(required);
}
