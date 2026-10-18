import { SwapOutlined, ToolOutlined } from '@ant-design/icons';
import { Button, Checkbox, Form, Input, InputNumber, Modal, Select, Table, Typography } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { Product, StockLevel, Warehouse } from '../../api/types';
import { Can } from '../../auth/guards';
import { PERMISSIONS } from '../../auth/permissions';
import { PageHeader } from '../../components/PageHeader';
import { SearchInput } from '../../components/SearchInput';
import { useApiMutation, useList, useOptions, usePaginated } from '../../hooks/useApi';
import { useTableState } from '../../hooks/useTableState';
import { formatCurrency, formatDateTime, formatQuantity } from '../../lib/format';

const STOCK_KEYS = ['/inventory/stock/levels', '/inventory/stock/movements', '/inventory/products', '/dashboard/summary'];

export function StockLevelsPage() {
  const [params] = useSearchParams();
  const table = useTableState(50);
  const [warehouseId, setWarehouseId] = useState<string>();
  const [lowStock, setLowStock] = useState(params.get('lowStock') === 'true');
  const [dialog, setDialog] = useState<'adjust' | 'transfer' | null>(null);

  const { data, isFetching } = usePaginated<StockLevel>('/inventory/stock/levels', {
    page: table.page,
    pageSize: table.pageSize,
    search: table.search,
    warehouseId,
    lowStock: lowStock || undefined,
  });
  const { data: warehouses } = useList<Warehouse>('/inventory/warehouses');
  const warehouseOptions = warehouses?.filter((w) => w.isActive).map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })) ?? [];

  return (
    <>
      <PageHeader
        title="Stock on Hand"
        subtitle="Current quantities by product and warehouse"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock on Hand' }]}
        actions={
          <Can permission={PERMISSIONS.STOCK_ADJUST}>
            <Button icon={<SwapOutlined />} onClick={() => setDialog('transfer')}>
              Transfer
            </Button>
            <Button type="primary" icon={<ToolOutlined />} onClick={() => setDialog('adjust')}>
              Adjust stock
            </Button>
          </Can>
        }
      />
      <div className="table-card">
        <div className="table-toolbar">
          <SearchInput onSearch={table.setSearch} placeholder="Search SKU or product" />
          <Select
            allowClear
            placeholder="All warehouses"
            options={warehouseOptions}
            value={warehouseId}
            onChange={(v) => {
              setWarehouseId(v);
              table.setPage(1);
            }}
            style={{ width: 260 }}
          />
          <Checkbox
            checked={lowStock}
            onChange={(e) => {
              setLowStock(e.target.checked);
              table.setPage(1);
            }}
          >
            At or below reorder level
          </Checkbox>
        </div>
        <Table<StockLevel>
          rowKey={(r) => `${r.productId}:${r.warehouseId}`}
          loading={isFetching}
          dataSource={data?.data}
          pagination={table.pagination(data?.meta.total)}
          scroll={{ x: 1000 }}
          columns={[
            { title: 'SKU', dataIndex: 'sku', width: 160, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
            { title: 'Product', dataIndex: 'productName', ellipsis: true },
            { title: 'Warehouse', dataIndex: 'warehouseCode', width: 110 },
            {
              title: 'Quantity',
              dataIndex: 'quantity',
              width: 140,
              align: 'right',
              render: (v: number, r) => (
                <span className={r.reorderLevel > 0 && v <= r.reorderLevel ? 'text-danger' : undefined}>
                  {formatQuantity(v)} {r.uom}
                </span>
              ),
            },
            { title: 'Reorder level', dataIndex: 'reorderLevel', width: 130, align: 'right', render: (v: number, r) => `${formatQuantity(v)} ${r.uom}` },
            { title: 'Unit cost', dataIndex: 'costPrice', width: 130, align: 'right', render: formatCurrency },
            { title: 'Value', dataIndex: 'stockValue', width: 150, align: 'right', render: formatCurrency },
            { title: 'Last movement', dataIndex: 'updatedAt', width: 170, render: formatDateTime },
          ]}
        />
      </div>

      <AdjustmentModal open={dialog === 'adjust'} warehouseOptions={warehouseOptions} onClose={() => setDialog(null)} />
      <TransferModal open={dialog === 'transfer'} warehouseOptions={warehouseOptions} onClose={() => setDialog(null)} />
    </>
  );
}

function useProductOptions(enabled: boolean) {
  const { data } = useOptions<Product>('/inventory/products', enabled);
  return data?.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })) ?? [];
}

interface DialogProps {
  open: boolean;
  warehouseOptions: { value: string; label: string }[];
  onClose: () => void;
}

function AdjustmentModal({ open, warehouseOptions, onClose }: DialogProps) {
  const [form] = Form.useForm();
  const productOptions = useProductOptions(open);
  const [direction, setDirection] = useState<'in' | 'out'>('in');

  const save = useApiMutation({
    request: (v: { productId: string; warehouseId: string; quantity: number; note: string }) =>
      api.post('/inventory/stock/adjustments', { ...v, quantity: direction === 'in' ? v.quantity : -v.quantity }),
    invalidate: STOCK_KEYS,
    successMessage: 'Stock adjusted',
    onSuccess: onClose,
  });

  return (
    <Modal
      title="Stock adjustment"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Post adjustment"
      confirmLoading={save.isPending}
      destroyOnHidden
      afterClose={() => setDirection('in')}
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} preserve={false}>
        <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
          <Select showSearch={{ optionFilterProp: 'label' }} options={productOptions} placeholder="Select product" />
        </Form.Item>
        <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
          <Select options={warehouseOptions} placeholder="Select warehouse" />
        </Form.Item>
        <Form.Item label="Direction">
          <Select
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'in', label: 'Increase (found / excess)' },
              { value: 'out', label: 'Decrease (damage / shortage / scrap)' },
            ]}
          />
        </Form.Item>
        <Form.Item name="quantity" label="Quantity" rules={[{ required: true }, { type: 'number', min: 0.001, message: 'Must be greater than zero' }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="note" label="Reason" rules={[{ required: true, min: 3, max: 255 }]}>
          <Input.TextArea rows={2} placeholder="e.g. Physical count variance, damaged in handling" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function TransferModal({ open, warehouseOptions, onClose }: DialogProps) {
  const [form] = Form.useForm();
  const productOptions = useProductOptions(open);

  const save = useApiMutation({
    request: (v: Record<string, unknown>) => api.post('/inventory/stock/transfers', v),
    invalidate: STOCK_KEYS,
    successMessage: 'Stock transferred',
    onSuccess: onClose,
  });

  return (
    <Modal
      title="Warehouse transfer"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Post transfer"
      confirmLoading={save.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} preserve={false}>
        <Form.Item name="productId" label="Product" rules={[{ required: true }]}>
          <Select showSearch={{ optionFilterProp: 'label' }} options={productOptions} placeholder="Select product" />
        </Form.Item>
        <Form.Item name="fromWarehouseId" label="From warehouse" rules={[{ required: true }]}>
          <Select options={warehouseOptions} />
        </Form.Item>
        <Form.Item
          name="toWarehouseId"
          label="To warehouse"
          dependencies={['fromWarehouseId']}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                value && value === getFieldValue('fromWarehouseId')
                  ? Promise.reject(new Error('Choose a different warehouse'))
                  : Promise.resolve(),
            }),
          ]}
        >
          <Select options={warehouseOptions} />
        </Form.Item>
        <Form.Item name="quantity" label="Quantity" rules={[{ required: true }, { type: 'number', min: 0.001, message: 'Must be greater than zero' }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="note" label="Note">
          <Input.TextArea rows={2} maxLength={255} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
