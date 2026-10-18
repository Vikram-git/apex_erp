import { PlusOutlined } from '@ant-design/icons';
import { Button, DatePicker, Segmented, Table } from 'antd';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { OrderListRow } from '../../api/types';
import { Can } from '../../auth/guards';
import { PageHeader } from '../../components/PageHeader';
import { SearchInput } from '../../components/SearchInput';
import { StatusTag } from '../../components/StatusTag';
import { usePaginated } from '../../hooks/useApi';
import { useTableState } from '../../hooks/useTableState';
import { formatCurrency, formatDate } from '../../lib/format';
import type { OrderConfig } from './orderConfig';

export function OrdersListPage({ config }: { config: OrderConfig }) {
  const navigate = useNavigate();
  const table = useTableState();
  const [status, setStatus] = useState<string>('all');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const { data, isFetching } = usePaginated<OrderListRow>(config.resource, {
    page: table.page,
    pageSize: table.pageSize,
    search: table.search,
    status: status === 'all' ? undefined : status,
    from: range?.[0]?.format('YYYY-MM-DD'),
    to: range?.[1]?.format('YYYY-MM-DD'),
  });

  return (
    <>
      <PageHeader
        title={config.title}
        breadcrumbs={[{ label: config.module }, { label: config.title }]}
        actions={
          <Can permission={config.managePermission}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`${config.basePath}/new`)}>
              New {config.singular.toLowerCase()}
            </Button>
          </Can>
        }
      />
      <div className="table-card">
        <div className="table-toolbar">
          <Segmented
            value={status}
            onChange={(v) => {
              setStatus(v);
              table.setPage(1);
            }}
            options={[{ value: 'all', label: 'All' }, ...config.statuses.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))]}
          />
          <SearchInput onSearch={table.setSearch} placeholder={`Order # or ${config.partyLabel.toLowerCase()}`} />
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => {
              setRange(v);
              table.setPage(1);
            }}
            format="DD MMM YYYY"
          />
        </div>
        <Table<OrderListRow>
          rowKey="id"
          loading={isFetching}
          dataSource={data?.data}
          pagination={table.pagination(data?.meta.total)}
          scroll={{ x: 900 }}
          onRow={(r) => ({ onClick: () => navigate(`${config.basePath}/${r.id}`), style: { cursor: 'pointer' } })}
          columns={[
            {
              title: 'Order #',
              dataIndex: 'orderNumber',
              width: 160,
              render: (v: string, r) => (
                <Link to={`${config.basePath}/${r.id}`} onClick={(e) => e.stopPropagation()}>
                  {v}
                </Link>
              ),
            },
            { title: config.partyLabel, dataIndex: config.partyNameField, ellipsis: true },
            { title: 'Order date', dataIndex: 'orderDate', width: 130, render: formatDate },
            { title: 'Expected', dataIndex: 'expectedDate', width: 130, render: formatDate },
            { title: 'Warehouse', dataIndex: 'warehouseCode', width: 110 },
            { title: 'Status', dataIndex: 'status', width: 120, render: (s: string) => <StatusTag status={s} /> },
            { title: 'Total', dataIndex: 'total', width: 160, align: 'right', render: formatCurrency },
          ]}
        />
      </div>
    </>
  );
}
