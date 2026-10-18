import {
  AppstoreOutlined,
  FileDoneOutlined,
  InboxOutlined,
  RiseOutlined,
  ShoppingCartOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Empty, Progress, Row, Skeleton, Statistic, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import type { DashboardSummary } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { formatCompactCurrency, formatCurrency, formatDate, formatQuantity } from '../lib/format';
import { CHART_COLORS, KPI_COLORS } from '../theme';

function Kpi({ title, value, icon, color, footer }: { title: string; value: ReactNode; icon: ReactNode; color: string; footer?: ReactNode }) {
  return (
    <Card variant="borderless" className="kpi-card">
      <div className="kpi-icon" style={{ background: `${color}14`, color }}>
        {icon}
      </div>
      <Statistic title={title} value={value as string} />
      {footer && <div className="kpi-footer">{footer}</div>}
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['/dashboard/summary'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary')).data,
    refetchInterval: 60_000,
  });

  const greeting = dayjs().hour() < 12 ? 'Good morning' : dayjs().hour() < 17 ? 'Good afternoon' : 'Good evening';

  if (isLoading || !data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Skeleton active paragraph={{ rows: 10 }} />
      </>
    );
  }

  const trend = data.trend.map((t) => ({ ...t, label: dayjs(`${t.month}-01`).format('MMM YY') }));

  return (
    <>
      <PageHeader title={`${greeting}, ${user?.fullName.split(' ')[0]}`} subtitle={`Operations overview for ${dayjs().format('MMMM YYYY')}`} />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Kpi title="Sales this month" value={formatCurrency(data.salesThisMonth)} icon={<RiseOutlined />} color={KPI_COLORS.sales} footer={`${data.counts.openSalesOrders} open sales orders`} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Kpi title="Purchases this month" value={formatCurrency(data.purchasesThisMonth)} icon={<ShoppingCartOutlined />} color={KPI_COLORS.purchases} footer={`${data.counts.openPurchaseOrders} open purchase orders`} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Kpi title="Inventory value" value={formatCurrency(data.inventoryValue)} icon={<WalletOutlined />} color={KPI_COLORS.inventory} footer="At moving average cost" />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Kpi title="Active products" value={String(data.counts.products)} icon={<AppstoreOutlined />} color={KPI_COLORS.products} footer={`${data.counts.customers} customers · ${data.counts.suppliers} suppliers`} />
        </Col>

        <Col xs={24} xl={16}>
          <Card title="Sales vs purchases — last 6 months" variant="borderless">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v: number) => formatCompactCurrency(v)} tickLine={false} axisLine={false} width={80} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill={CHART_COLORS.sales} radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Purchases" fill={CHART_COLORS.purchases} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card
            title={
              <span>
                <InboxOutlined /> Reorder alerts
              </span>
            }
            extra={<Link to="/inventory/stock?lowStock=true">View all</Link>}
            variant="borderless"
            styles={{ body: { paddingTop: 8 } }}
          >
            {data.lowStock.length === 0 ? (
              <Empty description="All items are above reorder level" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              data.lowStock.map((item) => {
                const pct = Math.min(100, Math.round((item.onHand / item.reorderLevel) * 100));
                return (
                  <div key={item.id} className="reorder-row">
                    <div className="reorder-row-head">
                      <Typography.Text strong ellipsis style={{ maxWidth: 220 }}>
                        {item.name}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {formatQuantity(item.onHand)} / {formatQuantity(item.reorderLevel)} {item.uom}
                      </Typography.Text>
                    </div>
                    <Progress percent={pct} size="small" showInfo={false} strokeColor={pct < 50 ? '#ff4d4f' : '#faad14'} />
                  </div>
                );
              })
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title={
              <span>
                <FileDoneOutlined /> Recent sales orders
              </span>
            }
            extra={<Link to="/sales/orders">All orders</Link>}
            variant="borderless"
          >
            <Table
              rowKey="id"
              size="middle"
              pagination={false}
              dataSource={data.recentSales}
              columns={[
                { title: 'Order #', dataIndex: 'orderNumber', render: (v: string, r) => <Link to={`/sales/orders/${r.id}`}>{v}</Link> },
                { title: 'Customer', dataIndex: 'customerName' },
                { title: 'Date', dataIndex: 'orderDate', render: formatDate },
                { title: 'Status', dataIndex: 'status', render: (s: string) => <StatusTag status={s} /> },
                { title: 'Total', dataIndex: 'total', align: 'right', render: formatCurrency },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
