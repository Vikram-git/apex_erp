import { LockOutlined, LoginOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Divider, Form, Input, Spin, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DEMO_ACCOUNTS, DEMO_LOGIN_ENABLED, type DemoAccount } from '../auth/demoAccounts';
import { Logo } from '../components/Logo';

interface LoginValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoKey, setDemoKey] = useState<string | null>(null);
  const autoLoginStarted = useRef(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';
  const autoDemo = DEMO_LOGIN_ENABLED ? DEMO_ACCOUNTS.find((a) => a.key === searchParams.get('demo')) : undefined;

  const signIn = async (email: string, password: string) => {
    setError(null);
    await login(email, password);
    navigate(from, { replace: true });
  };

  const onFinish = async (values: LoginValues) => {
    setSubmitting(true);
    try {
      await signIn(values.email, values.password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const demoLogin = async (account: DemoAccount) => {
    setDemoKey(account.key);
    try {
      await signIn(account.email, account.password);
    } catch (err) {
      setError(`${getErrorMessage(err)}. Has the database been seeded (npm run db:seed)?`);
    } finally {
      setDemoKey(null);
    }
  };

  useEffect(() => {
    if (!autoDemo || user || autoLoginStarted.current) return;
    autoLoginStarted.current = true;
    void demoLogin(autoDemo);
  }, [autoDemo, user]);

  if (user) return <Navigate to={from} replace />;

  if (autoDemo && demoKey) {
    return (
      <div className="login-page">
        <Spin size="large" description={`Signing in as ${autoDemo.role}…`} />
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-hero">
          <Logo size={60} />
          <Typography.Title level={2} style={{ color: '#fff', marginTop: 24 }}>
            Apex ERP
          </Typography.Title>
          <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16 }}>
            Inventory, sales and procurement for manufacturing operations — in one place.
          </Typography.Paragraph>
        </div>
        <Card className="login-card" variant="borderless">
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            Sign in
          </Typography.Title>
          <Typography.Paragraph type="secondary">Use your company account to continue.</Typography.Paragraph>
          {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
          <Form<LoginValues> layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}>
              <Input prefix={<MailOutlined />} autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password' }]}>
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting} disabled={demoKey !== null}>
              Sign in
            </Button>
          </Form>

          {DEMO_LOGIN_ENABLED && (
            <>
              <Divider plain style={{ margin: '24px 0 16px' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  ONE-CLICK DEMO LOGIN
                </Typography.Text>
              </Divider>
              <div className="demo-accounts">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.key}
                    type="button"
                    className="demo-account"
                    disabled={demoKey !== null || submitting}
                    onClick={() => void demoLogin(account)}
                  >
                    <span className="demo-account-text">
                      <span className="demo-account-role">{account.role}</span>
                      <span className="demo-account-desc">{account.description}</span>
                    </span>
                    {demoKey === account.key ? <Spin size="small" /> : <LoginOutlined className="demo-account-icon" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
