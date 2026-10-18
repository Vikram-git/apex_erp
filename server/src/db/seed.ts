import { eq } from 'drizzle-orm';
import { PERMISSIONS as P } from '../lib/permissions.js';
import { hashPassword } from '../modules/auth/auth.service.js';
import { applyStockMovement } from '../modules/inventory/stock.service.js';
import * as purchase from '../modules/purchase/purchase.service.js';
import * as sales from '../modules/sales/sales.service.js';
import { db, pool } from './index.js';
import { categories, customers, products, roles, suppliers, users, warehouses } from './schema/index.js';

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@12345';

const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

async function seed() {
  const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, 'Administrator'));
  if (existing) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  const roleRows = await db
    .insert(roles)
    .values([
      { name: 'Administrator', description: 'Full system access', permissions: [P.ALL], isSystem: true },
      {
        name: 'Operations Manager',
        description: 'Oversees inventory, sales and purchasing',
        permissions: [
          P.DASHBOARD_VIEW, P.INVENTORY_VIEW, P.INVENTORY_MANAGE, P.STOCK_ADJUST,
          P.SALES_VIEW, P.SALES_MANAGE, P.SALES_APPROVE,
          P.PURCHASE_VIEW, P.PURCHASE_MANAGE, P.PURCHASE_APPROVE,
        ],
      },
      {
        name: 'Sales Executive',
        description: 'Manages customers and prepares sales orders',
        permissions: [P.DASHBOARD_VIEW, P.INVENTORY_VIEW, P.SALES_VIEW, P.SALES_MANAGE],
      },
      {
        name: 'Purchase Officer',
        description: 'Manages suppliers and prepares purchase orders',
        permissions: [P.DASHBOARD_VIEW, P.INVENTORY_VIEW, P.PURCHASE_VIEW, P.PURCHASE_MANAGE],
      },
      {
        name: 'Store Keeper',
        description: 'Maintains stock, receipts and dispatches',
        permissions: [P.INVENTORY_VIEW, P.STOCK_ADJUST, P.SALES_VIEW, P.PURCHASE_VIEW],
      },
    ])
    .returning();
  const roleId = (name: string) => roleRows.find((r) => r.name === name)!.id;

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const userRows = await db
    .insert(users)
    .values([
      { email: 'admin@erp.local', fullName: 'System Administrator', roleId: roleId('Administrator'), passwordHash },
      { email: 'manager@erp.local', fullName: 'Rajesh Kumar', roleId: roleId('Operations Manager'), passwordHash },
      { email: 'sales@erp.local', fullName: 'Priya Sharma', roleId: roleId('Sales Executive'), passwordHash },
      { email: 'purchase@erp.local', fullName: 'Arun Mehta', roleId: roleId('Purchase Officer'), passwordHash },
      { email: 'store@erp.local', fullName: 'Suresh Patil', roleId: roleId('Store Keeper'), passwordHash },
    ])
    .returning();
  const adminId = userRows[0]!.id;

  const categoryRows = await db
    .insert(categories)
    .values([
      { name: 'Raw Materials', description: 'Metals, polymers and base inputs' },
      { name: 'Components', description: 'Bought-out and machined parts' },
      { name: 'Sub-Assemblies', description: 'Intermediate assembled units' },
      { name: 'Finished Goods', description: 'Saleable products' },
      { name: 'Packaging', description: 'Boxes, crates and protective material' },
      { name: 'Consumables', description: 'Shop-floor consumables' },
    ])
    .returning();
  const categoryId = (name: string) => categoryRows.find((c) => c.name === name)!.id;

  const warehouseRows = await db
    .insert(warehouses)
    .values([
      { code: 'RMS', name: 'Raw Material Store', address: 'Plant 1, Bay A, MIDC Bhosari, Pune' },
      { code: 'WIP', name: 'Work-in-Progress Store', address: 'Plant 1, Assembly Line' },
      { code: 'FGS', name: 'Finished Goods Store', address: 'Plant 1, Dispatch Bay' },
    ])
    .returning();
  const warehouseId = (code: string) => warehouseRows.find((w) => w.code === code)!.id;

  type ProductSeed = typeof products.$inferInsert & { opening?: [string, number][] };
  const productSeeds: ProductSeed[] = [
    { sku: 'RM-SS304-2MM', name: 'Stainless Steel Sheet SS304 2mm', type: 'raw_material', categoryId: categoryId('Raw Materials'), uom: 'kg', costPrice: 245, salePrice: 0, taxRate: 18, reorderLevel: 500, opening: [['RMS', 1800]] },
    { sku: 'RM-MS-ROD-20', name: 'Mild Steel Round Rod 20mm', type: 'raw_material', categoryId: categoryId('Raw Materials'), uom: 'kg', costPrice: 68, salePrice: 0, taxRate: 18, reorderLevel: 800, opening: [['RMS', 650]] },
    { sku: 'RM-CI-CAST', name: 'Cast Iron Pump Casing (Raw)', type: 'raw_material', categoryId: categoryId('Raw Materials'), uom: 'pcs', costPrice: 1150, salePrice: 0, taxRate: 18, reorderLevel: 40, opening: [['RMS', 120]] },
    { sku: 'CP-MTR-2HP', name: 'Induction Motor 2HP 3-Phase', type: 'raw_material', categoryId: categoryId('Components'), uom: 'pcs', costPrice: 7800, salePrice: 0, taxRate: 18, reorderLevel: 25, opening: [['RMS', 60]] },
    { sku: 'CP-MTR-5HP', name: 'Induction Motor 5HP 3-Phase', type: 'raw_material', categoryId: categoryId('Components'), uom: 'pcs', costPrice: 14500, salePrice: 0, taxRate: 18, reorderLevel: 15, opening: [['RMS', 12]] },
    { sku: 'CP-BRG-6205', name: 'Ball Bearing 6205-2RS', type: 'raw_material', categoryId: categoryId('Components'), uom: 'pcs', costPrice: 95, salePrice: 0, taxRate: 18, reorderLevel: 300, opening: [['RMS', 1200]] },
    { sku: 'CP-SEAL-MECH-25', name: 'Mechanical Seal 25mm', type: 'raw_material', categoryId: categoryId('Components'), uom: 'pcs', costPrice: 420, salePrice: 0, taxRate: 18, reorderLevel: 100, opening: [['RMS', 85]] },
    { sku: 'CP-BOLT-M10', name: 'Hex Bolt M10x40 SS', type: 'raw_material', categoryId: categoryId('Components'), uom: 'pcs', costPrice: 12, salePrice: 0, taxRate: 18, reorderLevel: 2000, opening: [['RMS', 8500]] },
    { sku: 'SA-IMP-150', name: 'Impeller Assembly 150mm', type: 'semi_finished', categoryId: categoryId('Sub-Assemblies'), uom: 'pcs', costPrice: 2100, salePrice: 0, taxRate: 18, reorderLevel: 30, opening: [['WIP', 45]] },
    { sku: 'FG-CP-2HP', name: 'Centrifugal Pump 2HP', type: 'finished_good', categoryId: categoryId('Finished Goods'), uom: 'pcs', costPrice: 14200, salePrice: 21500, taxRate: 18, reorderLevel: 20, opening: [['FGS', 64]] },
    { sku: 'FG-CP-5HP', name: 'Centrifugal Pump 5HP', type: 'finished_good', categoryId: categoryId('Finished Goods'), uom: 'pcs', costPrice: 24800, salePrice: 36900, taxRate: 18, reorderLevel: 10, opening: [['FGS', 28]] },
    { sku: 'FG-SUB-1HP', name: 'Submersible Pump 1HP', type: 'finished_good', categoryId: categoryId('Finished Goods'), uom: 'pcs', costPrice: 8600, salePrice: 13200, taxRate: 18, reorderLevel: 25, opening: [['FGS', 18]] },
    { sku: 'FG-MON-0.5HP', name: 'Monoblock Pump 0.5HP', type: 'finished_good', categoryId: categoryId('Finished Goods'), uom: 'pcs', costPrice: 4200, salePrice: 6750, taxRate: 18, reorderLevel: 40, opening: [['FGS', 110]] },
    { sku: 'PK-CRATE-WD', name: 'Wooden Export Crate', type: 'consumable', categoryId: categoryId('Packaging'), uom: 'pcs', costPrice: 650, salePrice: 0, taxRate: 12, reorderLevel: 50, opening: [['FGS', 140]] },
    { sku: 'CS-WELD-ROD', name: 'Welding Electrode E6013 3.15mm', type: 'consumable', categoryId: categoryId('Consumables'), uom: 'box', costPrice: 540, salePrice: 0, taxRate: 18, reorderLevel: 20, opening: [['RMS', 14]] },
  ];

  const productRows = await db
    .insert(products)
    .values(productSeeds.map(({ opening: _opening, ...p }) => p))
    .returning();
  const product = (sku: string) => productRows.find((p) => p.sku === sku)!;

  await db.transaction(async (tx) => {
    for (const seedRow of productSeeds) {
      for (const [code, qty] of seedRow.opening ?? []) {
        await applyStockMovement(tx, {
          productId: product(seedRow.sku).id,
          warehouseId: warehouseId(code),
          quantity: qty,
          type: 'opening',
          referenceType: 'opening',
          note: 'Opening balance',
          userId: adminId,
        });
      }
    }
  });

  const customerRows = await db
    .insert(customers)
    .values([
      { code: 'CUS-00001', name: 'Shakti Agro Equipments Pvt Ltd', contactPerson: 'Vinod Joshi', email: 'purchase@shaktiagro.in', phone: '+91 98220 11223', taxId: '27AABCS1234F1Z5', address: 'Plot 14, Satpur MIDC, Nashik 422007', paymentTermsDays: 45, creditLimit: 2500000 },
      { code: 'CUS-00002', name: 'Kaveri Infrastructure Ltd', contactPerson: 'Lakshmi Narayan', email: 'procurement@kaveriinfra.com', phone: '+91 80 4123 9900', taxId: '29AACCK5678G1Z2', address: '7th Floor, Prestige Tower, Bengaluru 560001', paymentTermsDays: 60, creditLimit: 5000000 },
      { code: 'CUS-00003', name: 'Gujarat Water Solutions', contactPerson: 'Hitesh Patel', email: 'hitesh@gujwater.co.in', phone: '+91 79 2658 4411', taxId: '24AAFFG9012H1Z8', address: 'GIDC Vatva, Ahmedabad 382445', paymentTermsDays: 30, creditLimit: 1500000 },
      { code: 'CUS-00004', name: 'Deccan Building Services', contactPerson: 'Farhan Sheikh', email: 'farhan@deccanbs.in', phone: '+91 40 2789 3344', taxId: '36AAJFD3456K1Z1', address: 'Banjara Hills, Hyderabad 500034', paymentTermsDays: 30, creditLimit: 800000 },
    ])
    .returning();

  const supplierRows = await db
    .insert(suppliers)
    .values([
      { code: 'SUP-00001', name: 'Jindal Steel Traders', contactPerson: 'Manoj Agarwal', email: 'sales@jindalsteeltraders.in', phone: '+91 22 2851 7700', taxId: '27AADFJ7788L1Z3', address: 'Kalamboli Steel Market, Navi Mumbai 410218', paymentTermsDays: 30 },
      { code: 'SUP-00002', name: 'Crompton Motors Distribution', contactPerson: 'Sanjay Rao', email: 'orders@cmdist.co.in', phone: '+91 20 6601 2200', taxId: '27AAECC4455M1Z6', address: 'Pimpri Industrial Area, Pune 411018', paymentTermsDays: 45 },
      { code: 'SUP-00003', name: 'SKF Bearings Authorised Dealer', contactPerson: 'Neha Kulkarni', email: 'neha@bearingsplus.in', phone: '+91 20 2712 8800', taxId: '27AAHFB2233N1Z9', address: 'Bhosari MIDC, Pune 411026', paymentTermsDays: 30 },
      { code: 'SUP-00004', name: 'Kolhapur Foundry Works', contactPerson: 'Ganesh Desai', email: 'ganesh@kfw.co.in', phone: '+91 231 265 4400', taxId: '27AAKFK6677P1Z4', address: 'Shiroli MIDC, Kolhapur 416122', paymentTermsDays: 60 },
    ])
    .returning();

  const customer = (i: number) => customerRows[i]!.id;
  const supplier = (i: number) => supplierRows[i]!.id;
  const line = (sku: string, quantity: number, unitPrice?: number) => {
    const p = product(sku);
    return { productId: p.id, quantity, unitPrice: unitPrice ?? p.salePrice, taxRate: p.taxRate };
  };

  const purchasePlan = [
    { supplierId: supplier(0), days: 150, lines: [line('RM-SS304-2MM', 800, 238), line('RM-MS-ROD-20', 1000, 66)], flow: 'received' },
    { supplierId: supplier(1), days: 110, lines: [line('CP-MTR-2HP', 30, 7650), line('CP-MTR-5HP', 10, 14200)], flow: 'received' },
    { supplierId: supplier(2), days: 75, lines: [line('CP-BRG-6205', 600, 92), line('CP-SEAL-MECH-25', 120, 410)], flow: 'received' },
    { supplierId: supplier(3), days: 40, lines: [line('RM-CI-CAST', 80, 1180)], flow: 'received' },
    { supplierId: supplier(1), days: 12, lines: [line('CP-MTR-5HP', 20, 14600)], flow: 'approved' },
    { supplierId: supplier(0), days: 3, lines: [line('RM-MS-ROD-20', 1500, 69)], flow: 'draft' },
  ] as const;

  for (const plan of purchasePlan) {
    const { id } = await purchase.createPurchaseOrder(
      { supplierId: plan.supplierId, warehouseId: warehouseId('RMS'), orderDate: daysAgo(plan.days), expectedDate: daysAgo(plan.days - 10), lines: [...plan.lines] },
      adminId,
    );
    if (plan.flow !== 'draft') await purchase.approvePurchaseOrder(id);
    if (plan.flow === 'received') await purchase.receivePurchaseOrder(id, adminId);
  }

  const salesPlan = [
    { customerId: customer(0), days: 160, lines: [line('FG-CP-2HP', 12), line('FG-MON-0.5HP', 20)], flow: 'delivered' },
    { customerId: customer(1), days: 130, lines: [line('FG-CP-5HP', 6), line('FG-CP-2HP', 8)], flow: 'delivered' },
    { customerId: customer(2), days: 95, lines: [line('FG-SUB-1HP', 15), line('FG-MON-0.5HP', 25)], flow: 'delivered' },
    { customerId: customer(3), days: 70, lines: [line('FG-MON-0.5HP', 18)], flow: 'delivered' },
    { customerId: customer(1), days: 45, lines: [line('FG-CP-5HP', 8, 36000), line('FG-CP-2HP', 10, 21000)], flow: 'delivered' },
    { customerId: customer(0), days: 20, lines: [line('FG-CP-2HP', 14)], flow: 'delivered' },
    { customerId: customer(2), days: 8, lines: [line('FG-SUB-1HP', 6), line('FG-CP-2HP', 4)], flow: 'confirmed' },
    { customerId: customer(3), days: 2, lines: [line('FG-MON-0.5HP', 30, 6500)], flow: 'draft' },
  ] as const;

  for (const plan of salesPlan) {
    const { id } = await sales.createSalesOrder(
      { customerId: plan.customerId, warehouseId: warehouseId('FGS'), orderDate: daysAgo(plan.days), expectedDate: daysAgo(plan.days - 7), lines: [...plan.lines] },
      adminId,
    );
    if (plan.flow !== 'draft') await sales.confirmSalesOrder(id);
    if (plan.flow === 'delivered') await sales.deliverSalesOrder(id, adminId);
  }

  console.log('Seed completed.');
  console.log(`  Users (password: ${DEFAULT_PASSWORD}):`);
  for (const u of userRows) console.log(`    ${u.email}`);
}

try {
  await seed();
} catch (error) {
  console.error('Seed failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
