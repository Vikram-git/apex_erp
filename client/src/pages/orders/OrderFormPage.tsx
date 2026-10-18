import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Skeleton, Table, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { OrderDetail, Party, Product, Warehouse } from '../../api/types';
import { PageHeader } from '../../components/PageHeader';
import { useApiMutation, useList, useOptions, useRecord } from '../../hooks/useApi';
import { formatCurrency } from '../../lib/format';
import type { OrderConfig } from './orderConfig';

interface LineValues {
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  taxRate?: number;
}

interface FormValues {
  partyId: string;
  warehouseId: string;
  orderDate: Dayjs;
  expectedDate?: Dayjs | null;
  notes?: string;
  lines: LineValues[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function computeTotals(lines: LineValues[] | undefined) {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines ?? []) {
    const lineSubtotal = round2((l.quantity ?? 0) * (l.unitPrice ?? 0));
    subtotal += lineSubtotal;
    tax += round2((lineSubtotal * (l.taxRate ?? 0)) / 100);
  }
  return { subtotal: round2(subtotal), tax: round2(tax), total: round2(subtotal + tax) };
}

export function OrderFormPage({ config }: { config: OrderConfig }) {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();

  const { data: existing, isLoading } = useRecord<OrderDetail>(config.resource, id);
  const { data: parties } = useOptions<Party>(config.partyResource);
  const { data: products } = useOptions<Product>('/inventory/products');
  const { data: warehouses } = useList<Warehouse>('/inventory/warehouses');

  const productMap = useMemo(() => new Map(products?.map((p) => [p.id, p])), [products]);
  const lines = Form.useWatch('lines', form);
  const totals = computeTotals(lines);

  useEffect(() => {
    if (!existing) return;
    form.setFieldsValue({
      partyId: existing[config.partyIdField],
      warehouseId: existing.warehouseId,
      orderDate: dayjs(existing.orderDate),
      expectedDate: existing.expectedDate ? dayjs(existing.expectedDate) : null,
      notes: existing.notes ?? undefined,
      lines: existing.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate })),
    });
  }, [existing, form, config.partyIdField]);

  const save = useApiMutation({
    request: async (values: FormValues) => {
      const payload = {
        [config.partyIdField]: values.partyId,
        warehouseId: values.warehouseId,
        orderDate: values.orderDate.format('YYYY-MM-DD'),
        expectedDate: values.expectedDate ? values.expectedDate.format('YYYY-MM-DD') : null,
        notes: values.notes ?? null,
        lines: values.lines,
      };
      if (isEdit) {
        await api.put(`${config.resource}/${id}`, payload);
        return { id: id! };
      }
      return (await api.post<{ id: string }>(config.resource, payload)).data;
    },
    invalidate: [config.resource, '/dashboard/summary'],
    successMessage: isEdit ? 'Order updated' : 'Order created',
    onSuccess: (result) => navigate(`${config.basePath}/${result.id}`),
  });

  const onProductChange = (index: number, productId: string) => {
    const product = productMap.get(productId);
    if (!product) return;
    const current = form.getFieldValue(['lines', index]) as LineValues;
    form.setFieldValue(['lines', index], {
      ...current,
      productId,
      unitPrice: product[config.defaultPriceField],
      taxRate: product.taxRate,
      quantity: current.quantity ?? 1,
    });
  };

  if (isEdit && isLoading) return <Skeleton active paragraph={{ rows: 12 }} />;

  if (existing && existing.status !== 'draft') {
    return <Alert type="warning" showIcon title={`Only draft orders can be edited. This order is ${existing.status}.`} />;
  }

  const title = isEdit ? `Edit ${existing?.orderNumber ?? ''}` : `New ${config.singular.toLowerCase()}`;

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[{ label: config.module }, { label: config.title, to: config.basePath }, { label: isEdit ? 'Edit' : 'New' }]}
        actions={
          <>
            <Button onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
              {isEdit ? 'Save changes' : 'Save as draft'}
            </Button>
          </>
        }
      />

      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{ orderDate: dayjs(), lines: [{}] }}
        onFinish={(v) => save.mutate(v)}
      >
        <Card variant="borderless" title="Order details" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12} xl={8}>
              <Form.Item name="partyId" label={config.partyLabel} rules={[{ required: true }]}>
                <Select
                  showSearch={{ optionFilterProp: 'label' }}
                  placeholder={`Select ${config.partyLabel.toLowerCase()}`}
                  options={parties?.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
                <Select
                  placeholder="Select warehouse"
                  options={warehouses?.filter((w) => w.isActive).map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12} xl={5}>
              <Form.Item name="orderDate" label="Order date" rules={[{ required: true }]}>
                <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} xl={5}>
              <Form.Item
                name="expectedDate"
                label="Expected date"
                dependencies={['orderDate']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: (_, value: Dayjs | null) =>
                      !value || !value.isBefore(getFieldValue('orderDate') as Dayjs, 'day')
                        ? Promise.resolve()
                        : Promise.reject(new Error('Cannot be before order date')),
                  }),
                ]}
              >
                <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card variant="borderless" title="Line items" style={{ marginBottom: 16 }}>
          <Form.List
            name="lines"
            rules={[{ validator: async (_, value: unknown[]) => (value?.length ? undefined : Promise.reject(new Error('Add at least one line'))) }]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <Table
                  dataSource={fields}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  scroll={{ x: 900 }}
                  columns={[
                    { title: '#', width: 40, render: (_, __, index) => index + 1 },
                    {
                      title: 'Product',
                      render: (_, field) => (
                        <Form.Item name={[field.name, 'productId']} rules={[{ required: true, message: 'Required' }]} style={{ margin: 0 }}>
                          <Select
                            showSearch={{ optionFilterProp: 'label' }}
                            placeholder="Select product"
                            options={products?.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))}
                            onChange={(v: string) => onProductChange(field.name, v)}
                            popupMatchSelectWidth={false}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'Quantity',
                      width: 140,
                      render: (_, field) => {
                        const uom = productMap.get(lines?.[field.name]?.productId ?? '')?.uom;
                        return (
                          <Form.Item
                            name={[field.name, 'quantity']}
                            rules={[{ required: true, message: 'Required' }, { type: 'number', min: 0.001, message: '> 0' }]}
                            style={{ margin: 0 }}
                          >
                            <InputNumber min={0} style={{ width: '100%' }} suffix={uom} />
                          </Form.Item>
                        );
                      },
                    },
                    {
                      title: 'Unit price (₹)',
                      width: 150,
                      render: (_, field) => (
                        <Form.Item name={[field.name, 'unitPrice']} rules={[{ required: true, message: 'Required' }]} style={{ margin: 0 }}>
                          <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'GST %',
                      width: 100,
                      render: (_, field) => (
                        <Form.Item name={[field.name, 'taxRate']} rules={[{ required: true, message: 'Required' }]} style={{ margin: 0 }}>
                          <InputNumber min={0} max={100} style={{ width: '100%' }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: 'Amount',
                      width: 150,
                      align: 'right',
                      render: (_, field) => {
                        const l = lines?.[field.name];
                        const sub = round2((l?.quantity ?? 0) * (l?.unitPrice ?? 0));
                        return formatCurrency(round2(sub + (sub * (l?.taxRate ?? 0)) / 100));
                      },
                    },
                    {
                      width: 50,
                      render: (_, field) => (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label="Remove line"
                          disabled={fields.length === 1}
                          onClick={() => remove(field.name)}
                        />
                      ),
                    },
                  ]}
                />
                <Form.ErrorList errors={errors} />
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})} style={{ marginTop: 12 }}>
                  Add line
                </Button>
              </>
            )}
          </Form.List>

          <div className="totals-box">
            <div>
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div>
              <span>GST</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
            <div className="grand">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </Card>

        <Card variant="borderless" title="Notes">
          <Form.Item name="notes" style={{ margin: 0 }}>
            <Input.TextArea rows={3} maxLength={2000} showCount placeholder="Delivery instructions, terms, references…" />
          </Form.Item>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Totals are recalculated by the server when the order is saved.
          </Typography.Text>
        </Card>
      </Form>
    </>
  );
}
