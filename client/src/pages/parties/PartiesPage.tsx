import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, Drawer, Form, Input, InputNumber, Popconfirm, Row, Space, Switch, Table, Typography } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import type { Party } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { SearchInput } from '../../components/SearchInput';
import { ActiveTag } from '../../components/StatusTag';
import { useApiMutation, usePaginated } from '../../hooks/useApi';
import { useTableState } from '../../hooks/useTableState';
import { formatCurrency } from '../../lib/format';
import type { PartyConfig } from './partyConfig';

type PartyForm = Omit<Party, 'id'>;

export function PartiesPage({ config }: { config: PartyConfig }) {
  const { can } = useAuth();
  const canManage = can(config.managePermission);
  const table = useTableState();
  const [editing, setEditing] = useState<Party | 'new' | null>(null);
  const [form] = Form.useForm<PartyForm>();
  const isNew = editing === 'new';

  const { data, isFetching } = usePaginated<Party>(config.resource, {
    page: table.page,
    pageSize: table.pageSize,
    search: table.search,
  });

  const save = useApiMutation({
    request: (values: PartyForm) =>
      isNew ? api.post(config.resource, values) : api.put(`${config.resource}/${(editing as Party).id}`, values),
    invalidate: [config.resource],
    successMessage: `${config.singular} saved`,
    onSuccess: () => setEditing(null),
  });

  const remove = useApiMutation({
    request: (id: string) => api.delete(`${config.resource}/${id}`),
    invalidate: [config.resource],
    successMessage: `${config.singular} deleted`,
  });

  return (
    <>
      <PageHeader
        title={config.plural}
        breadcrumbs={[{ label: config.module }, { label: config.plural }]}
        actions={
          canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
              New {config.singular.toLowerCase()}
            </Button>
          )
        }
      />
      <div className="table-card">
        <div className="table-toolbar">
          <SearchInput onSearch={table.setSearch} placeholder="Search name, code or email" />
        </div>
        <Table<Party>
          rowKey="id"
          loading={isFetching}
          dataSource={data?.data}
          pagination={table.pagination(data?.meta.total)}
          scroll={{ x: 1100 }}
          columns={[
            { title: 'Code', dataIndex: 'code', width: 120, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
            { title: 'Name', dataIndex: 'name', ellipsis: true },
            { title: 'Contact', dataIndex: 'contactPerson', width: 160, render: (v: string | null) => v ?? '—' },
            { title: 'Email', dataIndex: 'email', width: 230, ellipsis: true, render: (v: string | null) => v ?? '—' },
            { title: 'Phone', dataIndex: 'phone', width: 160, render: (v: string | null) => v ?? '—' },
            { title: 'GSTIN', dataIndex: 'taxId', width: 170, render: (v: string | null) => v ?? '—' },
            { title: 'Terms', dataIndex: 'paymentTermsDays', width: 90, align: 'right', render: (v: number) => `${v} days` },
            ...(config.hasCreditLimit
              ? [{ title: 'Credit limit', dataIndex: 'creditLimit', width: 140, align: 'right' as const, render: formatCurrency }]
              : []),
            { title: 'Status', dataIndex: 'isActive', width: 100, render: (v: boolean) => <ActiveTag active={v} /> },
            ...(canManage
              ? [
                  {
                    title: '',
                    key: 'actions',
                    width: 100,
                    fixed: 'right' as const,
                    render: (_: unknown, r: Party) => (
                      <Space>
                        <Button type="text" icon={<EditOutlined />} aria-label="Edit" onClick={() => setEditing(r)} />
                        <Popconfirm
                          title={`Delete this ${config.singular.toLowerCase()}?`}
                          description="Records with orders cannot be deleted; deactivate them instead."
                          onConfirm={() => remove.mutate(r.id)}
                        >
                          <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete" />
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>

      <Drawer
        title={isNew ? `New ${config.singular.toLowerCase()}` : `Edit ${config.singular.toLowerCase()}`}
        open={editing !== null}
        onClose={() => setEditing(null)}
        size={600}
        destroyOnHidden
        afterOpenChange={(open) => {
          if (!open) return;
          form.setFieldsValue(isNew ? { paymentTermsDays: 30, creditLimit: 0, isActive: true } : (editing as Party));
        }}
        extra={
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
            Save
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark="optional">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="code" label="Code" extra={isNew ? 'Leave blank to auto-generate' : undefined}>
                <Input style={{ textTransform: 'uppercase' }} disabled={!isNew} maxLength={20} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="name" label="Legal name" rules={[{ required: true, min: 2, max: 200 }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactPerson" label="Contact person">
                <Input maxLength={150} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input maxLength={30} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taxId" label="GSTIN / Tax ID">
                <Input maxLength={30} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={3} maxLength={1000} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="paymentTermsDays" label="Payment terms (days)" rules={[{ required: true }]}>
                <InputNumber min={0} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            {config.hasCreditLimit && (
              <Col span={12}>
                <Form.Item name="creditLimit" label="Credit limit (₹)" rules={[{ required: true }]}>
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}
            <Col span={24}>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </>
  );
}
