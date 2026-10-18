import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { Session } from './types';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

let accessToken: string | null = null;
let refreshInFlight: Promise<Session | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const onSessionExpired = (handler: () => void) => {
  sessionExpiredHandler = handler;
};

/** Exchanges the httpOnly refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<Session | null> {
  refreshInFlight ??= axios
    .post<Session>('/api/auth/refresh', null, { withCredentials: true })
    .then((res) => {
      setAccessToken(res.data.accessToken);
      return res.data;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthCall = original?.url?.startsWith('/auth/');

  if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
    original._retried = true;
    const session = await refreshSession();
    if (session) return api(original);
    sessionExpiredHandler?.();
  }
  return Promise.reject(error);
});

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    const details = body?.error?.details;
    if (Array.isArray(details) && details.length > 0) {
      const first = details[0] as { path?: string; message?: string };
      return `${body?.error?.message}: ${first.path ? `${first.path} - ` : ''}${first.message ?? ''}`;
    }
    if (body?.error?.message) return body.error.message;
    if (!error.response) return 'Unable to reach the server. Check your connection.';
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
