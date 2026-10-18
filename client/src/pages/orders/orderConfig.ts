import { PERMISSIONS } from '../../auth/permissions';
import type { OrderDetail } from '../../api/types';

export interface OrderAction {
  key: string;
  label: string;
  from: string[];
  confirmTitle: string;
  confirmText: string;
  primary?: boolean;
  danger?: boolean;
}

export interface OrderConfig {
  resource: string;
  basePath: string;
  module: string;
  title: string;
  singular: string;
  partyLabel: string;
  partyResource: string;
  partyIdField: 'customerId' | 'supplierId';
  partyKey: 'customer' | 'supplier';
  partyNameField: 'customerName' | 'supplierName';
  defaultPriceField: 'salePrice' | 'costPrice';
  managePermission: string;
  approvePermission: string;
  statuses: string[];
  actions: OrderAction[];
  timeline: { status: string; label: string; at: keyof OrderDetail }[];
}

export const SALES_ORDER_CONFIG: OrderConfig = {
  resource: '/sales-orders',
  basePath: '/sales/orders',
  module: 'Sales',
  title: 'Sales Orders',
  singular: 'Sales order',
  partyLabel: 'Customer',
  partyResource: '/customers',
  partyIdField: 'customerId',
  partyKey: 'customer',
  partyNameField: 'customerName',
  defaultPriceField: 'salePrice',
  managePermission: PERMISSIONS.SALES_MANAGE,
  approvePermission: PERMISSIONS.SALES_APPROVE,
  statuses: ['draft', 'confirmed', 'delivered', 'cancelled'],
  actions: [
    {
      key: 'confirm',
      label: 'Confirm order',
      from: ['draft'],
      primary: true,
      confirmTitle: 'Confirm this sales order?',
      confirmText: 'The order will be locked for editing and released for dispatch.',
    },
    {
      key: 'deliver',
      label: 'Mark delivered',
      from: ['confirmed'],
      primary: true,
      confirmTitle: 'Post delivery?',
      confirmText: 'Stock for all lines will be deducted from the selected warehouse. This cannot be undone.',
    },
    {
      key: 'cancel',
      label: 'Cancel order',
      from: ['draft', 'confirmed'],
      danger: true,
      confirmTitle: 'Cancel this sales order?',
      confirmText: 'The order will be closed. No stock is affected.',
    },
  ],
  timeline: [
    { status: 'draft', label: 'Created', at: 'createdAt' },
    { status: 'confirmed', label: 'Confirmed', at: 'confirmedAt' },
    { status: 'delivered', label: 'Delivered', at: 'deliveredAt' },
  ],
};

export const PURCHASE_ORDER_CONFIG: OrderConfig = {
  resource: '/purchase-orders',
  basePath: '/purchase/orders',
  module: 'Purchase',
  title: 'Purchase Orders',
  singular: 'Purchase order',
  partyLabel: 'Supplier',
  partyResource: '/suppliers',
  partyIdField: 'supplierId',
  partyKey: 'supplier',
  partyNameField: 'supplierName',
  defaultPriceField: 'costPrice',
  managePermission: PERMISSIONS.PURCHASE_MANAGE,
  approvePermission: PERMISSIONS.PURCHASE_APPROVE,
  statuses: ['draft', 'approved', 'received', 'cancelled'],
  actions: [
    {
      key: 'approve',
      label: 'Approve',
      from: ['draft'],
      primary: true,
      confirmTitle: 'Approve this purchase order?',
      confirmText: 'The order will be locked for editing and can be sent to the supplier.',
    },
    {
      key: 'receive',
      label: 'Receive goods',
      from: ['approved'],
      primary: true,
      confirmTitle: 'Post goods receipt?',
      confirmText: 'Stock for all lines will be added to the selected warehouse and product costs updated. This cannot be undone.',
    },
    {
      key: 'cancel',
      label: 'Cancel order',
      from: ['draft', 'approved'],
      danger: true,
      confirmTitle: 'Cancel this purchase order?',
      confirmText: 'The order will be closed. No stock is affected.',
    },
  ],
  timeline: [
    { status: 'draft', label: 'Created', at: 'createdAt' },
    { status: 'approved', label: 'Approved', at: 'approvedAt' },
    { status: 'received', label: 'Received', at: 'receivedAt' },
  ],
};
