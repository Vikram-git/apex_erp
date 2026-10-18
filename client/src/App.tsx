import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, Button, ConfigProvider, Result } from 'antd';
import enGB from 'antd/locale/en_GB';
import { AxiosError } from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/en-gb';
import { lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth, RequirePermission } from './auth/guards';
import { PERMISSIONS } from './auth/permissions';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { PURCHASE_ORDER_CONFIG, SALES_ORDER_CONFIG } from './pages/orders/orderConfig';
import { CUSTOMER_CONFIG, SUPPLIER_CONFIG } from './pages/parties/partyConfig';
import { theme } from './theme';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProductsPage = lazy(() => import('./pages/inventory/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const StockLevelsPage = lazy(() => import('./pages/inventory/StockLevelsPage').then((m) => ({ default: m.StockLevelsPage })));
const StockMovementsPage = lazy(() => import('./pages/inventory/StockMovementsPage').then((m) => ({ default: m.StockMovementsPage })));
const CategoriesPage = lazy(() => import('./pages/inventory/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const WarehousesPage = lazy(() => import('./pages/inventory/WarehousesPage').then((m) => ({ default: m.WarehousesPage })));
const PartiesPage = lazy(() => import('./pages/parties/PartiesPage').then((m) => ({ default: m.PartiesPage })));
const OrdersListPage = lazy(() => import('./pages/orders/OrdersListPage').then((m) => ({ default: m.OrdersListPage })));
const OrderFormPage = lazy(() => import('./pages/orders/OrderFormPage').then((m) => ({ default: m.OrderFormPage })));
const OrderDetailPage = lazy(() => import('./pages/orders/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage })));
const UsersPage = lazy(() => import('./pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import('./pages/admin/RolesPage').then((m) => ({ default: m.RolesPage })));

dayjs.locale('en-gb');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = error instanceof AxiosError ? error.response?.status : undefined;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

function HomeRoute() {
  const { can } = useAuth();
  if (can(PERMISSIONS.DASHBOARD_VIEW)) return <DashboardPage />;
  if (can(PERMISSIONS.INVENTORY_VIEW)) return <Navigate to="/inventory/stock" replace />;
  if (can(PERMISSIONS.SALES_VIEW)) return <Navigate to="/sales/orders" replace />;
  if (can(PERMISSIONS.PURCHASE_VIEW)) return <Navigate to="/purchase/orders" replace />;
  return <Result status="info" title="Welcome" subTitle="Your account has no modules assigned yet. Contact your administrator." />;
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <Result status="404" title="Page not found" extra={<Button onClick={() => navigate('/')}>Back to home</Button>} />
  );
}

const guard = (permission: string, element: ReactNode) => <RequirePermission permission={permission}>{element}</RequirePermission>;

export function App() {
  return (
    <ConfigProvider theme={theme} locale={enGB}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <RequireAuth>
                      <AppLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<HomeRoute />} />

                  <Route path="inventory">
                    <Route path="products" element={guard(PERMISSIONS.INVENTORY_VIEW, <ProductsPage />)} />
                    <Route path="stock" element={guard(PERMISSIONS.INVENTORY_VIEW, <StockLevelsPage />)} />
                    <Route path="movements" element={guard(PERMISSIONS.INVENTORY_VIEW, <StockMovementsPage />)} />
                    <Route path="categories" element={guard(PERMISSIONS.INVENTORY_VIEW, <CategoriesPage />)} />
                    <Route path="warehouses" element={guard(PERMISSIONS.INVENTORY_VIEW, <WarehousesPage />)} />
                  </Route>

                  <Route path="sales">
                    <Route path="customers" element={guard(PERMISSIONS.SALES_VIEW, <PartiesPage key="customers" config={CUSTOMER_CONFIG} />)} />
                    <Route path="orders" element={guard(PERMISSIONS.SALES_VIEW, <OrdersListPage key="so" config={SALES_ORDER_CONFIG} />)} />
                    <Route path="orders/new" element={guard(PERMISSIONS.SALES_MANAGE, <OrderFormPage key="so-new" config={SALES_ORDER_CONFIG} />)} />
                    <Route path="orders/:id" element={guard(PERMISSIONS.SALES_VIEW, <OrderDetailPage config={SALES_ORDER_CONFIG} />)} />
                    <Route path="orders/:id/edit" element={guard(PERMISSIONS.SALES_MANAGE, <OrderFormPage key="so-edit" config={SALES_ORDER_CONFIG} />)} />
                  </Route>

                  <Route path="purchase">
                    <Route path="suppliers" element={guard(PERMISSIONS.PURCHASE_VIEW, <PartiesPage key="suppliers" config={SUPPLIER_CONFIG} />)} />
                    <Route path="orders" element={guard(PERMISSIONS.PURCHASE_VIEW, <OrdersListPage key="po" config={PURCHASE_ORDER_CONFIG} />)} />
                    <Route path="orders/new" element={guard(PERMISSIONS.PURCHASE_MANAGE, <OrderFormPage key="po-new" config={PURCHASE_ORDER_CONFIG} />)} />
                    <Route path="orders/:id" element={guard(PERMISSIONS.PURCHASE_VIEW, <OrderDetailPage config={PURCHASE_ORDER_CONFIG} />)} />
                    <Route path="orders/:id/edit" element={guard(PERMISSIONS.PURCHASE_MANAGE, <OrderFormPage key="po-edit" config={PURCHASE_ORDER_CONFIG} />)} />
                  </Route>

                  <Route path="admin">
                    <Route path="users" element={guard(PERMISSIONS.USERS_MANAGE, <UsersPage />)} />
                    <Route path="roles" element={guard(PERMISSIONS.USERS_MANAGE, <RolesPage />)} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
