import { type CookieOptions, type Request, type Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { isProduction } from '../../config/env.js';
import { parse, passwordPolicy } from '../../lib/http.js';
import { authenticate, currentUser } from '../../middleware/auth.js';
import * as authService from './auth.service.js';

const REFRESH_COOKIE = 'erp_rt';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/api/auth',
};

const loginSchema = z.object({
  email: z.email().trim(),
  password: z.string().min(1).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordPolicy,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Try again later.' } },
});

const clientInfo = (req: Request) => ({ userAgent: req.get('user-agent'), ipAddress: req.ip });

function sendSession(res: Response, session: Awaited<ReturnType<typeof authService.login>>) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, { ...cookieOptions, expires: session.refreshExpiresAt });
  res.json({ accessToken: session.accessToken, user: session.user });
}

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  sendSession(res, await authService.login(email, password, clientInfo(req)));
});

authRouter.post('/refresh', async (req, res) => {
  const token: unknown = req.cookies?.[REFRESH_COOKIE];
  if (typeof token !== 'string' || token.length === 0) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Session expired' } });
    return;
  }
  try {
    sendSession(res, await authService.refresh(token, clientInfo(req)));
  } catch (error) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    throw error;
  }
});

authRouter.post('/logout', async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.status(204).end();
});

authRouter.get('/me', authenticate, async (req, res) => {
  res.json(await authService.getProfile(currentUser(req).id));
});

authRouter.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  await authService.changePassword(currentUser(req).id, currentPassword, newPassword);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.status(204).end();
});
