import { Select, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { StockMovement, StockMovementType, Warehouse } from '../../api/types';
import { PageHeader } from '../../components/PageHeader';
import { SearchInput } from '../../components/SearchInput';
import { useList, usePaginated } from '../../hooks/useApi';
import { useTableState } from '../../hooks/useTableState';
import { formatDateTime, formatQuantity, MOVEMENT_TYPE_LABELS } from '../../lib/format';

const TYPE_COLORS: Record<StockMovementType, string> = {
  opening: 'default',
  purchase_receipt: 'green',
  sales_delivery: 'blue',
  adjustment: 'orange',
  transfer_in: 'cyan',
  transfer_out: 'purple',
};

export function StockMovementsPage() {
  const table = useTableState(50);
  const [type, setType] = useState<StockMovementType>();
  const [warehouseId, setWarehouseId] = useState<string>();

  const { data, isFetching } = usePaginated<StockMovement>('/inventory/stock/movements', {
    page: table.page,
    pageSize: table.pageSize,
    search: table.search,
    type,
    warehouseId,
  });
  const { data: warehouses } = useList<Warehouse>('/inventory/warehouses');

  return (
    <>
      <PageHeader
        title="Stock Ledger"
        subtitle="Every stock movement with running balance — the audit trail for inventory"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Stock Ledger' }]}
      />
      <div className="table-card">
        <div className="table-toolbar">
          <SearchInput onSearch={table.setSearch} placeholder="Search product or reference" />
          <Select
            allowClear
            placeholder="All movement types"
            options={Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            value={type}
            onChange={(v) => {
              setType(v);
              table.setPage(1);
            }}
            style={{ width: 200 }}
          />
          <Select
            allowClear
            placeholder="All warehouses"
            options={warehouses?.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))}
            value={warehouseId}
            onChange={(v) => {
              setWarehouseId(v);
              table.setPage(1);
            }}
            style={{ width: 240 }}
          />
        </div>
        <Table<StockMovement>
          rowKey="id"
          loading={isFetching}
          dataSource={data?.data}
          pagination={table.pagination(data?.meta.total)}
          scroll={{ x: 1200 }}
          columns={[
            { title: 'Date', dataIndex: 'createdAt', width: 170, render: formatDateTime },
            { title: 'Type', dataIndex: 'type', width: 160, render: (v: StockMovementType) => <Tag color={TYPE_COLORS[v]}>{MOVEMENT_TYPE_LABELS[v]}</Tag> },
            { title: 'SKU', dataIndex: 'sku', width: 150, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
            { title: 'Product', dataIndex: 'productName', ellipsis: true },
            { title: 'Warehouse', dataIndex: 'warehouseCode', width: 100 },
            {
              title: 'Quantity',
              dataIndex: 'quantity',
              width: 120,
              align: 'right',
              render: (v: number, r) => (
                <span className={v < 0 ? 'text-danger' : 'text-success'}>
                  {v > 0 ? '+' : ''}
                  {formatQuantity(v)} {r.uom}
                </span>
              ),
            },
            { title: 'Balance', dataIndex: 'balanceAfter', width: 120, align: 'right', render: (v: number, r) => `${formatQuantity(v)} ${r.uom}` },
            { title: 'Reference', dataIndex: 'referenceNumber', width: 150, render: (v: string | null) => v ?? '—' },
            { title: 'Note', dataIndex: 'note', ellipsis: true, render: (v: string | null) => v ?? '—' },
            { title: 'By', dataIndex: 'userName', width: 160, render: (v: string | null) => v ?? '—' },
          ]}
        />
      </div>
    </>
  );
}
