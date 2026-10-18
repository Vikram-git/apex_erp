import { Button, Result, Spin } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="fullscreen-center">
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  if (!can(permission)) {
    return (
      <Result
        status="403"
        title="Access denied"
        subTitle="Your role does not have access to this page. Contact your administrator if you need it."
        extra={<Button onClick={() => navigate('/')}>Back to home</Button>}
      />
    );
  }
  return <>{children}</>;
}

export function Can({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : null;
}
