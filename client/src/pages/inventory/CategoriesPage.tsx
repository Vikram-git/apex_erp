import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Popconfirm, Space, Table } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import type { Category } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { PageHeader } from '../../components/PageHeader';
import { useApiMutation, useList } from '../../hooks/useApi';

const RESOURCE = '/inventory/categories';

export function CategoriesPage() {
  const { can } = useAuth();
  const canManage = can(PERMISSIONS.INVENTORY_MANAGE);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [form] = Form.useForm<Pick<Category, 'name' | 'description'>>();
  const { data, isLoading } = useList<Category>(RESOURCE);
  const isNew = editing === 'new';

  const save = useApiMutation({
    request: (values: Pick<Category, 'name' | 'description'>) =>
      isNew ? api.post(RESOURCE, values) : api.put(`${RESOURCE}/${(editing as Category).id}`, values),
    invalidate: [RESOURCE],
    successMessage: 'Category saved',
    onSuccess: () => setEditing(null),
  });

  const remove = useApiMutation({
    request: (id: string) => api.delete(`${RESOURCE}/${id}`),
    invalidate: [RESOURCE],
    successMessage: 'Category deleted',
  });

  return (
    <>
      <PageHeader
        title="Categories"
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Categories' }]}
        actions={
          canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
              New category
            </Button>
          )
        }
      />
      <div className="table-card">
        <Table<Category>
          rowKey="id"
          loading={isLoading}
          dataSource={data}
          pagination={false}
          columns={[
            { title: 'Name', dataIndex: 'name' },
            { title: 'Description', dataIndex: 'description', render: (v: string | null) => v ?? '—' },
            { title: 'Products', dataIndex: 'productCount', width: 120, align: 'right' },
            ...(canManage
              ? [
                  {
                    title: '',
                    key: 'actions',
                    width: 100,
                    render: (_: unknown, r: Category) => (
                      <Space>
                        <Button type="text" icon={<EditOutlined />} aria-label="Edit" onClick={() => setEditing(r)} />
                        <Popconfirm
                          title="Delete this category?"
                          description="Products in it will become uncategorised."
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

      <Modal
        title={isNew ? 'New category' : 'Edit category'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnHidden
        afterOpenChange={(open) => open && form.setFieldsValue(isNew ? { name: '', description: '' } : (editing as Category))}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="name" label="Name" rules={[{ required: true, min: 2, max: 100 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ max: 255 }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
