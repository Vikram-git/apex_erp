import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Col, Form, Input, Modal, Popconfirm, Row, Space, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { api } from '../../api/client';
import type { PermissionInfo, Role } from '../../api/types';
import { PERMISSIONS } from '../../auth/permissions';
import { PageHeader } from '../../components/PageHeader';
import { useApiMutation, useList } from '../../hooks/useApi';

const RESOURCE = '/admin/roles';

interface RoleForm {
  name: string;
  description?: string;
  permissions: string[];
}

export function RolesPage() {
  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const [form] = Form.useForm<RoleForm>();
  const isNew = editing === 'new';
  const editingSystem = !isNew && editing?.isSystem;

  const { data: roles, isLoading } = useList<Role>(RESOURCE);
  const { data: catalog } = useList<PermissionInfo>(`${RESOURCE}/permissions`);
  const labels = useMemo(() => new Map(catalog?.map((p) => [p.key, p.label])), [catalog]);
  const groups = useMemo(() => {
    const map = new Map<string, PermissionInfo[]>();
    for (const p of catalog ?? []) map.set(p.group, [...(map.get(p.group) ?? []), p]);
    return [...map.entries()];
  }, [catalog]);

  const save = useApiMutation({
    request: (v: RoleForm) => (isNew ? api.post(RESOURCE, v) : api.put(`${RESOURCE}/${(editing as Role).id}`, v)),
    invalidate: [RESOURCE],
    successMessage: 'Role saved. Users get the new permissions on their next sign-in or token refresh.',
    onSuccess: () => setEditing(null),
  });

  const remove = useApiMutation({
    request: (id: string) => api.delete(`${RESOURCE}/${id}`),
    invalidate: [RESOURCE],
    successMessage: 'Role deleted',
  });

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what each job function is allowed to see and do"
        breadcrumbs={[{ label: 'Administration' }, { label: 'Roles & Permissions' }]}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            New role
          </Button>
        }
      />
      <div className="table-card">
        <Table<Role>
          rowKey="id"
          loading={isLoading}
          dataSource={roles}
          pagination={false}
          columns={[
            {
              title: 'Role',
              dataIndex: 'name',
              width: 220,
              render: (v: string, r) => (
                <Space>
                  <Typography.Text strong>{v}</Typography.Text>
                  {r.isSystem && <Tag>System</Tag>}
                </Space>
              ),
            },
            { title: 'Description', dataIndex: 'description', render: (v: string | null) => v ?? '—' },
            {
              title: 'Permissions',
              dataIndex: 'permissions',
              render: (perms: string[]) =>
                perms.includes(PERMISSIONS.ALL) ? (
                  <Tag color="gold">Full access</Tag>
                ) : (
                  <Space size={[4, 4]} wrap>
                    {perms.map((p) => (
                      <Tag key={p} title={labels.get(p)}>
                        {p}
                      </Tag>
                    ))}
                  </Space>
                ),
            },
            { title: 'Users', dataIndex: 'userCount', width: 80, align: 'right' },
            {
              title: '',
              key: 'actions',
              width: 100,
              render: (_, r) => (
                <Space>
                  <Button type="text" icon={<EditOutlined />} aria-label="Edit" onClick={() => setEditing(r)} />
                  {!r.isSystem && (
                    <Popconfirm title="Delete this role?" onConfirm={() => remove.mutate(r.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete" disabled={r.userCount > 0} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={isNew ? 'New role' : 'Edit role'}
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        width={720}
        destroyOnHidden
        afterOpenChange={(open) =>
          open &&
          form.setFieldsValue(
            isNew
              ? { name: '', description: '', permissions: [] }
              : { name: (editing as Role).name, description: (editing as Role).description ?? '', permissions: (editing as Role).permissions },
          )
        }
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="name" label="Role name" rules={[{ required: true, min: 2, max: 50 }]}>
                <Input disabled={Boolean(editingSystem)} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="description" label="Description" rules={[{ max: 255 }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="permissions" label="Permissions">
            <Checkbox.Group style={{ width: '100%' }}>
              <div style={{ width: '100%' }}>
                <div className="perm-group">
                  <Checkbox value={PERMISSIONS.ALL} disabled={Boolean(editingSystem)}>
                    <Typography.Text strong>Full access (administrator)</Typography.Text>
                  </Checkbox>
                </div>
                {groups.map(([group, perms]) => (
                  <div key={group} className="perm-group">
                    <Typography.Text type="secondary" className="perm-group-title">
                      {group}
                    </Typography.Text>
                    <Row gutter={[8, 8]}>
                      {perms.map((p) => (
                        <Col span={12} key={p.key}>
                          <Checkbox value={p.key}>{p.label}</Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
