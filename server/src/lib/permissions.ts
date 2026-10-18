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

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: { key: Permission; group: string; label: string }[] = [
  { key: PERMISSIONS.DASHBOARD_VIEW, group: 'General', label: 'View dashboard' },
  { key: PERMISSIONS.USERS_MANAGE, group: 'Administration', label: 'Manage users and roles' },
  { key: PERMISSIONS.INVENTORY_VIEW, group: 'Inventory', label: 'View products, warehouses and stock' },
  { key: PERMISSIONS.INVENTORY_MANAGE, group: 'Inventory', label: 'Create and edit products, categories, warehouses' },
  { key: PERMISSIONS.STOCK_ADJUST, group: 'Inventory', label: 'Post stock adjustments and transfers' },
  { key: PERMISSIONS.SALES_VIEW, group: 'Sales', label: 'View customers and sales orders' },
  { key: PERMISSIONS.SALES_MANAGE, group: 'Sales', label: 'Create and edit customers and draft sales orders' },
  { key: PERMISSIONS.SALES_APPROVE, group: 'Sales', label: 'Confirm, deliver and cancel sales orders' },
  { key: PERMISSIONS.PURCHASE_VIEW, group: 'Purchase', label: 'View suppliers and purchase orders' },
  { key: PERMISSIONS.PURCHASE_MANAGE, group: 'Purchase', label: 'Create and edit suppliers and draft purchase orders' },
  { key: PERMISSIONS.PURCHASE_APPROVE, group: 'Purchase', label: 'Approve, receive and cancel purchase orders' },
];

export const ASSIGNABLE_PERMISSIONS = new Set<string>([
  PERMISSIONS.ALL,
  ...PERMISSION_CATALOG.map((p) => p.key),
]);

export function hasPermission(granted: readonly string[], required: string): boolean {
  return granted.includes(PERMISSIONS.ALL) || granted.includes(required);
}
