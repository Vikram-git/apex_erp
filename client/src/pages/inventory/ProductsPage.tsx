import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import type { Category, Product, ProductDetail, ProductType } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { PageHeader } from '../../components/PageHeader';
import { SearchInput } from '../../components/SearchInput';
import { ActiveTag } from '../../components/StatusTag';
import { useApiMutation, useList, usePaginated, useRecord } from '../../hooks/useApi';
import { useTableState } from '../../hooks/useTableState';
import { formatCurrency, formatQuantity, PRODUCT_TYPE_LABELS } from '../../lib/format';

const RESOURCE = '/inventory/products';
const UOM_OPTIONS = ['pcs', 'kg', 'g', 'm', 'mm', 'l', 'ml', 'box', 'set', 'pair', 'roll', 'sheet'].map((u) => ({ value: u, label: u }));
const TYPE_OPTIONS = Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

type ProductForm = Omit<Product, 'id' | 'categoryName' | 'onHand'>;

export function ProductsPage() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.INVENTORY_MANAGE);
  const table = useTableState();
  const [type, setType] = useState<ProductType>();
  const [categoryId, setCategoryId] = useState<string>();
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [viewingId, setViewingId] = useState<string>();

  const { data, isFetching } = usePaginated<Product>(RESOURCE, {
    page: table.page,
    pageSize: table.pageSize,
    search: table.search,
    type,
    categoryId,
  });
  const { data: categories } = useList<Category>('/inventory/categories');
  const categoryOptions = categories?.map((c) => ({ value: c.id, label: c.name })) ?? [];

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Raw materials, sub-assemblies, finished goods and consumables"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Products' }]}
        actions={
          canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
              New product
            </Button>
          )
        }
      />

      <div className="table-card">
        <div className="table-toolbar">
          <SearchInput onSearch={table.setSearch} placeholder="Search SKU or name" />
          <Select
            allowClear
            placeholder="All types"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(v) => {
              setType(v);
              table.setPage(1);
            }}
            style={{ width: 180 }}
          />
          <Select
            allowClear
            placeholder="All categories"
            options={categoryOptions}
            value={categoryId}
            onChange={(v) => {
              setCategoryId(v);
              table.setPage(1);
            }}
            style={{ width: 200 }}
          />
        </div>
        <Table<Product>
          rowKey="id"
          loading={isFetching}
          dataSource={data?.data}
          pagination={table.pagination(data?.meta.total)}
          scroll={{ x: 1100 }}
          onRow={(record) => ({ onClick: () => setViewingId(record.id), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'SKU', dataIndex: 'sku', width: 160, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
            { title: 'Name', dataIndex: 'name', ellipsis: true },
            { title: 'Type', dataIndex: 'type', width: 140, render: (v: string) => PRODUCT_TYPE_LABELS[v] },
            { title: 'Category', dataIndex: 'categoryName', width: 150, render: (v: string | null) => v ?? '—' },
            {
              title: 'On hand',
              dataIndex: 'onHand',
              width: 130,
              align: 'right',
              render: (v: number, r) => (
                <span className={r.reorderLevel > 0 && v <= r.reorderLevel ? 'text-danger' : undefined}>
                  {formatQuantity(v)} {r.uom}
                </span>
              ),
            },
            { title: 'Cost', dataIndex: 'costPrice', width: 130, align: 'right', render: formatCurrency },
            { title: 'Sale price', dataIndex: 'salePrice', width: 130, align: 'right', render: (v: number) => (v > 0 ? formatCurrency(v) : '—') },
            { title: 'Status', dataIndex: 'isActive', width: 100, render: (v: boolean) => <ActiveTag active={v} /> },
            ...(canManage
              ? [
                  {
                    title: '',
                    key: 'actions',
                    width: 60,
                    render: (_: unknown, r: Product) => (
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        aria-label="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(r);
                        }}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>

      <ProductDrawer product={editing} categoryOptions={categoryOptions} onClose={() => setEditing(null)} />
      <ProductStockModal productId={viewingId} onClose={() => setViewingId(undefined)} />
    </>
  );
}

function ProductDrawer({
  product,
  categoryOptions,
  onClose,
}: {
  product: Product | 'new' | null;
  categoryOptions: { value: string; label: string }[];
  onClose: () => void;
}) {
  const [form] = Form.useForm<ProductForm>();
  const isNew = product === 'new';

  const save = useApiMutation({
    request: (values: ProductForm) =>
      isNew ? api.post(RESOURCE, values) : api.put(`${RESOURCE}/${(product as Product).id}`, values),
    invalidate: [RESOURCE],
    successMessage: isNew ? 'Product created' : 'Product updated',
    onSuccess: onClose,
  });

  return (
    <Drawer
      title={isNew ? 'New product' : 'Edit product'}
      open={product !== null}
      onClose={onClose}
      size={620}
      destroyOnHidden
      afterOpenChange={(open) => {
        if (!open) return;
        form.setFieldsValue(
          isNew
            ? { type: 'raw_material', uom: 'pcs', costPrice: 0, salePrice: 0, taxRate: 18, reorderLevel: 0, isActive: true }
            : (product as Product),
        );
      }}
      extra={
        <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
          Save
        </Button>
      }
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark="optional">
        <Row gutter={16}>
          <Col span={10}>
            <Form.Item name="sku" label="SKU" rules={[{ required: true }, { pattern: /^[A-Za-z0-9._-]+$/, message: 'Letters, digits, . _ - only' }]}>
              <Input style={{ textTransform: 'uppercase' }} disabled={!isNew} />
            </Form.Item>
          </Col>
          <Col span={14}>
            <Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select options={TYPE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="categoryId" label="Category">
              <Select allowClear options={categoryOptions} placeholder="Select category" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="uom" label="Unit of measure" rules={[{ required: true }]}>
              <Select options={UOM_OPTIONS} showSearch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="taxRate" label="GST %" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="reorderLevel" label="Reorder level" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="costPrice" label="Standard cost (₹)" rules={[{ required: true }]} extra="Updated automatically on purchase receipts">
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="salePrice" label="Sale price (₹)" rules={[{ required: true }]}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={3} maxLength={2000} />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
}

function ProductStockModal({ productId, onClose }: { productId?: string; onClose: () => void }) {
  const { data } = useRecord<ProductDetail>(RESOURCE, productId);

  return (
    <Modal open={Boolean(productId)} onCancel={onClose} footer={null} width={720} title={data ? `${data.sku} — ${data.name}` : 'Product'}>
      {data && (
        <>
          <Descriptions
            size="small"
            column={2}
            bordered
            items={[
              { label: 'Type', children: PRODUCT_TYPE_LABELS[data.type] },
              { label: 'Category', children: data.categoryName ?? '—' },
              { label: 'Unit', children: data.uom },
              { label: 'GST', children: `${data.taxRate}%` },
              { label: 'Moving avg cost', children: formatCurrency(data.costPrice) },
              { label: 'Sale price', children: data.salePrice ? formatCurrency(data.salePrice) : '—' },
              { label: 'Reorder level', children: `${formatQuantity(data.reorderLevel)} ${data.uom}` },
              {
                label: 'Total on hand',
                children: (
                  <Tag color={data.reorderLevel > 0 && data.onHand <= data.reorderLevel ? 'red' : 'green'}>
                    {formatQuantity(data.onHand)} {data.uom}
                  </Tag>
                ),
              },
            ]}
          />
          <Typography.Title level={5} style={{ marginTop: 20 }}>
            Stock by warehouse
          </Typography.Title>
          <Table
            rowKey="warehouseId"
            size="small"
            pagination={false}
            dataSource={data.stock}
            locale={{ emptyText: 'No stock recorded' }}
            columns={[
              { title: 'Warehouse', render: (_, r) => `${r.warehouseCode} — ${r.warehouseName}` },
              { title: 'Quantity', dataIndex: 'quantity', align: 'right', render: (v: number) => `${formatQuantity(v)} ${data.uom}` },
              { title: 'Value', align: 'right', render: (_, r) => formatCurrency(r.quantity * data.costPrice) },
            ]}
          />
        </>
      )}
    </Modal>
  );
}
