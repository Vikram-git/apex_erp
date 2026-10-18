import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Switch, Table } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import type { AdminUser, Role } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { SearchInput } from '../../components/SearchInput';
import { ActiveTag } from '../../components/StatusTag';
import { useApiMutation, useList, usePaginated } from '../../hooks/useApi';
import { useTableState } from '../../hooks/useTableState';
import { formatDateTime } from '../../lib/format';

const RESOURCE = '/admin/users';

interface UserForm {
  email: string;
  fullName: string;
  roleId: string;
  password?: string;
  isActive: boolean;
}

export function UsersPage() {
  const { user: me } = useAuth();
  const table = useTableState();
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const [form] = Form.useForm<UserForm>();
  const isNew = editing === 'new';
  const isSelf = !isNew && editing !== null && editing.id === me?.id;

  const { data, isFetching } = usePaginated<AdminUser>(RESOURCE, { page: table.page, pageSize: table.pageSize, search: table.search });
  const { data: roles } = useList<Role>('/admin/roles');

  const save = useApiMutation({
    request: async (v: UserForm) => {
      if (isNew) {
        await api.post(RESOURCE, v);
        return;
      }
      const { email: _email, password, ...rest } = v;
      await api.patch(`${RESOURCE}/${(editing as AdminUser).id}`, { ...rest, ...(password ? { password } : {}) });
    },
    invalidate: [RESOURCE, '/admin/roles'],
    successMessage: 'User saved',
    onSuccess: () => setEditing(null),
  });

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="People who can sign in, and the role that controls what they can do"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Users' }]}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            New user
          </Button>
        }
      />
      <div className="table-card">
        <div className="table-toolbar">
          <SearchInput onSearch={table.setSearch} placeholder="Search name or email" />
        </div>
        <Table<AdminUser>
          rowKey="id"
          loading={isFetching}
          dataSource={data?.data}
          pagination={table.pagination(data?.meta.total)}
          columns={[
            { title: 'Name', dataIndex: 'fullName' },
            { title: 'Email', dataIndex: 'email' },
            { title: 'Role', dataIndex: 'roleName' },
            { title: 'Status', dataIndex: 'isActive', width: 110, render: (v: boolean) => <ActiveTag active={v} /> },
            { title: 'Last sign-in', dataIndex: 'lastLoginAt', width: 190, render: formatDateTime },
            {
              title: '',
              key: 'actions',
              width: 60,
              render: (_, r) => <Button type="text" icon={<EditOutlined />} aria-label="Edit" onClick={() => setEditing(r)} />,
            },
          ]}
        />
      </div>

      <Modal
        title={isNew ? 'New user' : 'Edit user'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        destroyOnHidden
        afterOpenChange={(open) => open && form.setFieldsValue(isNew ? { isActive: true } : { ...(editing as AdminUser), password: undefined })}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark="optional">
          <Form.Item name="fullName" label="Full name" rules={[{ required: true, min: 2, max: 150 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input disabled={!isNew} />
          </Form.Item>
          <Form.Item name="roleId" label="Role" rules={[{ required: true }]} extra={isSelf ? 'You cannot change your own role.' : undefined}>
            <Select disabled={isSelf} options={roles?.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
          <Form.Item
            name="password"
            label={isNew ? 'Password' : 'Reset password'}
            extra={isNew ? 'At least 8 characters with a letter and a number.' : 'Leave blank to keep the current password.'}
            rules={[
              { required: isNew },
              { min: 8, message: 'At least 8 characters' },
              { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Include a letter and a number' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch disabled={isSelf} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
