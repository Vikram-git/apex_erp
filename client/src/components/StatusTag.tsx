import { Tag } from 'antd';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  confirmed: 'processing',
  approved: 'processing',
  delivered: 'success',
  received: 'success',
  cancelled: 'error',
};

export function StatusTag({ status }: { status: string }) {
  return (
    <Tag color={STATUS_COLORS[status] ?? 'default'} style={{ textTransform: 'capitalize' }}>
      {status}
    </Tag>
  );
}

export function ActiveTag({ active }: { active: boolean }) {
  return active ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>;
}
