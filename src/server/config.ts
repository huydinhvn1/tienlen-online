import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export function loadEnvFile(): void {
  const file = path.resolve('.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function dataDir(): string {
  const dir = path.resolve(process.env.DATA_DIR || 'data');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function sessionSecret(): string {
  if (process.env.SESSION_SECRET?.trim()) return process.env.SESSION_SECRET.trim();
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'session.secret');
  if (existsSync(file)) {
    const existing = readFileSync(file, 'utf8').trim();
    if (existing) return existing;
  }
  const secret = randomBytes(32).toString('hex');
  writeFileSync(file, secret);
  return secret;
}

export function googleClientId(): string | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  return id ? id : null;
}

export function listenPort(): number {
  const port = Number(process.env.PORT || 47221);
  return Number.isFinite(port) && port > 0 ? port : 47221;
}
