import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Switch, Table, Typography } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import type { Warehouse } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { PageHeader } from '../../components/PageHeader';
import { ActiveTag } from '../../components/StatusTag';
import { useApiMutation, useList } from '../../hooks/useApi';

const RESOURCE = '/inventory/warehouses';
type WarehouseForm = Omit<Warehouse, 'id'>;

export function WarehousesPage() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.INVENTORY_MANAGE);
  const [editing, setEditing] = useState<Warehouse | 'new' | null>(null);
  const [form] = Form.useForm<WarehouseForm>();
  const { data, isLoading } = useList<Warehouse>(RESOURCE);
  const isNew = editing === 'new';

  const save = useApiMutation({
    request: (values: WarehouseForm) =>
      isNew ? api.post(RESOURCE, values) : api.put(`${RESOURCE}/${(editing as Warehouse).id}`, values),
    invalidate: [RESOURCE],
    successMessage: 'Warehouse saved',
    onSuccess: () => setEditing(null),
  });

  return (
    <>
      <PageHeader
        title="Warehouses"
        subtitle="Storage locations used for stock and order fulfilment"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Warehouses' }]}
        actions={
          canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
              New warehouse
            </Button>
          )
        }
      />
      <div className="table-card">
        <Table<Warehouse>
          rowKey="id"
          loading={isLoading}
          dataSource={data}
          pagination={false}
          columns={[
            { title: 'Code', dataIndex: 'code', width: 120, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
            { title: 'Name', dataIndex: 'name' },
            { title: 'Address', dataIndex: 'address', render: (v: string | null) => v ?? '—' },
            { title: 'Status', dataIndex: 'isActive', width: 110, render: (v: boolean) => <ActiveTag active={v} /> },
            ...(canManage
              ? [
                  {
                    title: '',
                    key: 'actions',
                    width: 60,
                    render: (_: unknown, r: Warehouse) => (
                      <Button type="text" icon={<EditOutlined />} aria-label="Edit" onClick={() => setEditing(r)} />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>

      <Modal
        title={isNew ? 'New warehouse' : 'Edit warehouse'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnHidden
        afterOpenChange={(open) => open && form.setFieldsValue(isNew ? { isActive: true } : (editing as Warehouse))}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="code" label="Code" rules={[{ required: true, min: 2, max: 20 }]}>
            <Input style={{ textTransform: 'uppercase' }} disabled={!isNew} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, min: 2, max: 100 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
