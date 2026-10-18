export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  permissions: string[];
}

export interface Session {
  accessToken: string;
  user: UserProfile;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export type ProductType = 'raw_material' | 'semi_finished' | 'finished_good' | 'consumable';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  productCount?: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  type: ProductType;
  categoryId: string | null;
  categoryName: string | null;
  uom: string;
  costPrice: number;
  salePrice: number;
  taxRate: number;
  reorderLevel: number;
  isActive: boolean;
  onHand: number;
}

export interface ProductDetail extends Product {
  stock: { warehouseId: string; warehouseCode: string; warehouseName: string; quantity: number }[];
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
}

export interface StockLevel {
  productId: string;
  sku: string;
  productName: string;
  uom: string;
  reorderLevel: number;
  costPrice: number;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  stockValue: number;
  updatedAt: string;
}

export type StockMovementType =
  | 'opening'
  | 'purchase_receipt'
  | 'sales_delivery'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out';

export interface StockMovement {
  id: string;
  type: StockMovementType;
  quantity: number;
  balanceAfter: number;
  referenceNumber: string | null;
  note: string | null;
  createdAt: string;
  sku: string;
  productName: string;
  uom: string;
  warehouseCode: string;
  userName: string | null;
}

export interface Party {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  paymentTermsDays: number;
  isActive: boolean;
  creditLimit?: number;
}

export interface OrderListRow {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  total: number;
  customerName?: string;
  supplierName?: string;
  warehouseCode: string;
}

export interface OrderLine {
  id: string;
  lineNo: number;
  productId: string;
  sku: string;
  productName: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  warehouseId: string;
  customerId?: string;
  supplierId?: string;
  customer?: PartySummary;
  supplier?: PartySummary;
  warehouse: { id: string; code: string; name: string };
  createdByName: string | null;
  createdAt: string;
  confirmedAt?: string | null;
  approvedAt?: string | null;
  deliveredAt?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
  lines: OrderLine[];
}

export interface PartySummary {
  id: string;
  code: string;
  name: string;
  address: string | null;
  taxId: string | null;
}

export interface DashboardSummary {
  counts: { products: number; customers: number; suppliers: number; openSalesOrders: number; openPurchaseOrders: number };
  salesThisMonth: number;
  purchasesThisMonth: number;
  inventoryValue: number;
  lowStock: { id: string; sku: string; name: string; uom: string; reorderLevel: number; onHand: number }[];
  trend: { month: string; sales: number; purchases: number }[];
  recentSales: { id: string; orderNumber: string; customerName: string; status: string; orderDate: string; total: number }[];
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roleId: string;
  roleName: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
}

export interface PermissionInfo {
  key: string;
  group: string;
  label: string;
}
