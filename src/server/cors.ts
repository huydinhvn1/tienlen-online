import type { NextFunction, Request, Response } from 'express';

export const DEFAULT_CORS_ORIGINS = [
  'https://huydinh.app',
  'https://www.huydinh.app',
  'https://huydinh.info',
  'https://www.huydinh.info',
  'https://tienlen-online.onrender.com',
];

export function allowedCorsOrigins(env = process.env): Set<string> {
  const extra = (env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return new Set([...DEFAULT_CORS_ORIGINS, ...extra]);
}

export function isAllowedCorsOrigin(origin: string | undefined, allowed = allowedCorsOrigins()): boolean {
  if (!origin) return true;
  return allowed.has(origin);
}

export function applyCorsHeaders(req: Request, res: Response, allowed = allowedCorsOrigins()): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!allowed.has(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  return true;
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  applyCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
