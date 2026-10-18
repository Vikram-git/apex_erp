export interface DemoAccount {
  key: string;
  email: string;
  password: string;
  role: string;
  description: string;
}

/** Mirrors the users created by `npm run db:seed`. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: 'admin', email: 'admin@erp.local', password: 'Admin@12345', role: 'Administrator', description: 'Full access' },
  { key: 'manager', email: 'manager@erp.local', password: 'Admin@12345', role: 'Operations Manager', description: 'Inventory, sales, purchase' },
  { key: 'sales', email: 'sales@erp.local', password: 'Admin@12345', role: 'Sales Executive', description: 'Customers, draft orders' },
  { key: 'purchase', email: 'purchase@erp.local', password: 'Admin@12345', role: 'Purchase Officer', description: 'Suppliers, draft POs' },
  { key: 'store', email: 'store@erp.local', password: 'Admin@12345', role: 'Store Keeper', description: 'Stock adjustments, transfers' },
];

// Never enable in production builds that point at real data
export const DEMO_LOGIN_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';
