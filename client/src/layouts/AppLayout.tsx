import {
  AppstoreOutlined,
  DashboardOutlined,
  DownOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Flex, Layout, Menu, Skeleton, Typography, type MenuProps } from 'antd';
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PERMISSIONS } from '../auth/permissions';
import { Logo } from '../components/Logo';
import { ChangePasswordModal } from '../pages/account/ChangePasswordModal';
import { BRAND } from '../theme';

type MenuItem = Required<MenuProps>['items'][number] & { key: string };

interface NavNode {
  key: string;
  label: string;
  icon?: ReactNode;
  permission?: string;
  children?: NavNode[];
}

const NAVIGATION: NavNode[] = [
  { key: '/', label: 'Dashboard', icon: <DashboardOutlined />, permission: PERMISSIONS.DASHBOARD_VIEW },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: <AppstoreOutlined />,
    children: [
      { key: '/inventory/products', label: 'Products', permission: PERMISSIONS.INVENTORY_VIEW },
      { key: '/inventory/stock', label: 'Stock on Hand', permission: PERMISSIONS.INVENTORY_VIEW },
      { key: '/inventory/movements', label: 'Stock Ledger', permission: PERMISSIONS.INVENTORY_VIEW },
      { key: '/inventory/categories', label: 'Categories', permission: PERMISSIONS.INVENTORY_VIEW },
      { key: '/inventory/warehouses', label: 'Warehouses', permission: PERMISSIONS.INVENTORY_VIEW },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    icon: <ShopOutlined />,
    children: [
      { key: '/sales/orders', label: 'Sales Orders', permission: PERMISSIONS.SALES_VIEW },
      { key: '/sales/customers', label: 'Customers', permission: PERMISSIONS.SALES_VIEW },
    ],
  },
  {
    key: 'purchase',
    label: 'Purchase',
    icon: <ShoppingCartOutlined />,
    children: [
      { key: '/purchase/orders', label: 'Purchase Orders', permission: PERMISSIONS.PURCHASE_VIEW },
      { key: '/purchase/suppliers', label: 'Suppliers', permission: PERMISSIONS.PURCHASE_VIEW },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    icon: <SafetyOutlined />,
    children: [
      { key: '/admin/users', label: 'Users', icon: <TeamOutlined />, permission: PERMISSIONS.USERS_MANAGE },
      { key: '/admin/roles', label: 'Roles & Permissions', icon: <KeyOutlined />, permission: PERMISSIONS.USERS_MANAGE },
    ],
  },
];

function buildMenu(nodes: NavNode[], can: (p: string) => boolean): MenuItem[] {
  return nodes.flatMap<MenuItem>((node) => {
    if (node.children) {
      const children = buildMenu(node.children, can);
      return children.length ? [{ key: node.key, label: node.label, icon: node.icon, children }] : [];
    }
    if (node.permission && !can(node.permission)) return [];
    return [{ key: node.key, label: node.label, icon: node.icon }];
  });
}

function selectedKeyFor(pathname: string): string {
  if (pathname === '/') return '/';
  const leaves = NAVIGATION.flatMap((n) => (n.children ? n.children : [n])).map((n) => n.key);
  return leaves.filter((k) => k !== '/' && pathname.startsWith(k)).sort((a, b) => b.length - a.length)[0] ?? pathname;
}

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const items = useMemo(() => buildMenu(NAVIGATION, can), [can]);
  const selectedKey = selectedKeyFor(location.pathname);
  const parentKey = NAVIGATION.find((n) => n.children?.some((c) => c.key === selectedKey))?.key;
  const [openKeys, setOpenKeys] = useState<string[]>(parentKey ? [parentKey] : []);

  const userMenu: MenuProps['items'] = [
    { key: 'password', icon: <KeyOutlined />, label: 'Change password', onClick: () => setPasswordOpen(true) },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', danger: true, onClick: () => void logout() },
  ];

  const initials = user?.fullName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={240}
        theme="dark"
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
      >
        <div className="brand">
          <Logo size={34} />
          {!collapsed && (
            <div>
              <div className="brand-title">Apex ERP</div>
              <div className="brand-subtitle">Manufacturing Suite</div>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          selectedKeys={[selectedKey]}
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={setOpenKeys}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="app-header">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle navigation"
          />
          <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight">
            <Flex align="center" gap={10} style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: BRAND.primary }}>{initials}</Avatar>
              <div style={{ lineHeight: 1.2 }}>
                <Typography.Text strong style={{ display: 'block' }}>
                  {user?.fullName}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {user?.role}
                </Typography.Text>
              </div>
              <DownOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
            </Flex>
          </Dropdown>
        </Layout.Header>
        <Layout.Content className="app-content">
          <Suspense fallback={<Skeleton active paragraph={{ rows: 10 }} />}>
            <Outlet />
          </Suspense>
        </Layout.Content>
        <Layout.Footer className="app-footer">Apex ERP © {new Date().getFullYear()}</Layout.Footer>
      </Layout>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </Layout>
  );
}
