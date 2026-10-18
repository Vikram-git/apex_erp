import { PERMISSIONS } from '../../auth/permissions';

export interface PartyConfig {
  resource: string;
  singular: string;
  plural: string;
  module: string;
  managePermission: string;
  hasCreditLimit: boolean;
}

export const CUSTOMER_CONFIG: PartyConfig = {
  resource: '/customers',
  singular: 'Customer',
  plural: 'Customers',
  module: 'Sales',
  managePermission: PERMISSIONS.SALES_MANAGE,
  hasCreditLimit: true,
};

export const SUPPLIER_CONFIG: PartyConfig = {
  resource: '/suppliers',
  singular: 'Supplier',
  plural: 'Suppliers',
  module: 'Purchase',
  managePermission: PERMISSIONS.PURCHASE_MANAGE,
  hasCreditLimit: false,
};
