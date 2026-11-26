import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';

const COOKIE = 'tl_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function signSession(userId: string, secret: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: now + MAX_AGE_MS })).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function userIdFromCookie(header: string | undefined, secret: string): string | null {
  if (!header) return null;
  let token = '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === COOKIE) token = decodeURIComponent(rest.join('='));
  }
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as { uid?: string; exp?: number };
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export function writeSessionCookie(res: Response, token: string | null): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  if (!token) {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return;
  }
  const maxAge = Math.floor(MAX_AGE_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`,
  );
}
