import { DeleteOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Descriptions, Result, Row, Skeleton, Steps, Table, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { OrderDetail, OrderLine } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { useApiMutation, useRecord } from '../../hooks/useApi';
import { formatCurrency, formatDate, formatDateTime, formatQuantity } from '../../lib/format';
import type { OrderAction, OrderConfig } from './orderConfig';

const STOCK_KEYS = ['/inventory/stock/levels', '/inventory/stock/movements', '/inventory/products', '/dashboard/summary'];

export function OrderDetailPage({ config }: { config: OrderConfig }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { modal } = App.useApp();
  const { data: order, isLoading, isError } = useRecord<OrderDetail>(config.resource, id);

  const runAction = useApiMutation({
    request: (action: OrderAction) => api.post(`${config.resource}/${id}/${action.key}`),
    invalidate: [config.resource, ...STOCK_KEYS],
    successMessage: 'Order updated',
  });

  const remove = useApiMutation({
    request: () => api.delete(`${config.resource}/${id}`),
    invalidate: [config.resource, '/dashboard/summary'],
    successMessage: 'Draft deleted',
    onSuccess: () => navigate(config.basePath),
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 14 }} />;
  if (isError || !order) {
    return <Result status="404" title="Order not found" extra={<Button onClick={() => navigate(config.basePath)}>Back to list</Button>} />;
  }

  const party = order[config.partyKey];
  const isDraft = order.status === 'draft';
  const availableActions = can(config.approvePermission) ? config.actions.filter((a) => a.from.includes(order.status)) : [];

  const confirmAction = (action: OrderAction) =>
    modal.confirm({
      title: action.confirmTitle,
      content: action.confirmText,
      okText: action.label,
      okButtonProps: { danger: action.danger },
      onOk: () => runAction.mutateAsync(action),
    });

  const currentStep = order.status === 'cancelled' ? -1 : config.timeline.findIndex((t) => t.status === order.status);

  return (
    <>
      <PageHeader
        title={
          <span>
            {order.orderNumber} <StatusTag status={order.status} />
          </span>
        }
        subtitle={`${config.partyLabel}: ${party?.name ?? ''}`}
        breadcrumbs={[{ label: config.module }, { label: config.title, to: config.basePath }, { label: order.orderNumber }]}
        actions={
          <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print
            </Button>
            {isDraft && can(config.managePermission) && (
              <>
                <Button icon={<EditOutlined />} onClick={() => navigate(`${config.basePath}/${order.id}/edit`)}>
                  Edit
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    modal.confirm({
                      title: 'Delete this draft?',
                      content: 'The draft and its lines will be permanently removed.',
                      okText: 'Delete',
                      okButtonProps: { danger: true },
                      onOk: () => remove.mutateAsync(),
                    })
                  }
                >
                  Delete
                </Button>
              </>
            )}
            {availableActions.map((action) => (
              <Button
                key={action.key}
                type={action.primary ? 'primary' : 'default'}
                danger={action.danger}
                loading={runAction.isPending && runAction.variables?.key === action.key}
                onClick={() => confirmAction(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        }
      />

      <Card variant="borderless" style={{ marginBottom: 16 }} className="no-print">
        {order.status === 'cancelled' ? (
          <Typography.Text type="danger">Cancelled on {formatDateTime(order.cancelledAt)}</Typography.Text>
        ) : (
          <Steps
            current={currentStep}
            items={config.timeline.map((t) => ({
              title: t.label,
              content: order[t.at] ? formatDateTime(order[t.at] as string) : undefined,
            }))}
          />
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card variant="borderless" title="Line items" style={{ marginBottom: 16 }}>
            <Table<OrderLine>
              rowKey="id"
              size="middle"
              pagination={false}
              dataSource={order.lines}
              scroll={{ x: 700 }}
              columns={[
                { title: '#', dataIndex: 'lineNo', width: 40 },
                {
                  title: 'Product',
                  render: (_, l) => (
                    <>
                      <Typography.Text code>{l.sku}</Typography.Text> {l.productName}
                    </>
                  ),
                },
                { title: 'Qty', dataIndex: 'quantity', align: 'right', width: 110, render: (v: number, l) => `${formatQuantity(v)} ${l.uom}` },
                { title: 'Rate', dataIndex: 'unitPrice', align: 'right', width: 130, render: formatCurrency },
                { title: 'GST', dataIndex: 'taxRate', align: 'right', width: 70, render: (v: number) => `${v}%` },
                { title: 'Amount', dataIndex: 'lineTotal', align: 'right', width: 150, render: formatCurrency },
              ]}
            />
            <div className="totals-box">
              <div>
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div>
                <span>GST</span>
                <span>{formatCurrency(order.taxTotal)}</span>
              </div>
              <div className="grand">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card variant="borderless" title={config.partyLabel} style={{ marginBottom: 16 }}>
            <Typography.Text strong>{party?.name}</Typography.Text>
            <div>
              <Typography.Text type="secondary">{party?.code}</Typography.Text>
            </div>
            {party?.address && <div style={{ marginTop: 8, whiteSpace: 'pre-line' }}>{party.address}</div>}
            {party?.taxId && <div style={{ marginTop: 8 }}>GSTIN: {party.taxId}</div>}
          </Card>
          <Card variant="borderless" title="Details" style={{ marginBottom: 16 }}>
            <Descriptions
              column={1}
              size="small"
              items={[
                { label: 'Order date', children: formatDate(order.orderDate) },
                { label: 'Expected', children: formatDate(order.expectedDate) },
                { label: 'Warehouse', children: `${order.warehouse.code} — ${order.warehouse.name}` },
                { label: 'Created by', children: order.createdByName ?? '—' },
                { label: 'Created at', children: formatDateTime(order.createdAt) },
              ]}
            />
          </Card>
          {order.notes && (
            <Card variant="borderless" title="Notes">
              <Typography.Paragraph style={{ whiteSpace: 'pre-line', margin: 0 }}>{order.notes}</Typography.Paragraph>
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
}
