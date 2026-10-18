import { Form, Input, Modal } from 'antd';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useApiMutation } from '../../hooks/useApi';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<FormValues>();
  const { logout } = useAuth();

  const mutation = useApiMutation({
    request: (values: FormValues) =>
      api.post('/auth/change-password', { currentPassword: values.currentPassword, newPassword: values.newPassword }),
    invalidate: [],
    successMessage: 'Password changed. Please sign in again.',
    onSuccess: () => {
      onClose();
      void logout();
    },
  });

  return (
    <Modal
      title="Change password"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Update password"
      confirmLoading={mutation.isPending}
      destroyOnHidden
      afterClose={() => form.resetFields()}
    >
      <Form form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)} requiredMark={false}>
        <Form.Item name="currentPassword" label="Current password" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="New password"
          extra="At least 8 characters with a letter and a number."
          rules={[
            { required: true },
            { min: 8, message: 'At least 8 characters' },
            { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Include a letter and a number' },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Confirm new password"
          dependencies={['newPassword']}
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue('newPassword') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error('Passwords do not match')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
