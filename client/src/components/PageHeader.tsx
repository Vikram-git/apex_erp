import { Breadcrumb, Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      {breadcrumbs && (
        <Breadcrumb
          items={breadcrumbs.map((b) => ({ title: b.to ? <Link to={b.to}>{b.label}</Link> : b.label }))}
          style={{ marginBottom: 8 }}
        />
      )}
      <Flex justify="space-between" align="center" gap={16} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
        </div>
        {actions && (
          <Flex gap={8} wrap>
            {actions}
          </Flex>
        )}
      </Flex>
    </div>
  );
}
