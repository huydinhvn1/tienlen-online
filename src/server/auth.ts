import { OAuth2Client } from 'google-auth-library';
import type { Express, Request, Response } from 'express';
import type { AppDb } from './db.ts';
import { signSession, userIdFromCookie, writeSessionCookie } from './session.ts';

const guestHits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (guestHits.get(ip) ?? []).filter((stamp) => now - stamp < 60 * 60 * 1000);
  if (recent.length >= 40) {
    guestHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  guestHits.set(ip, recent);
  return false;
}

function cleanName(name: string, fallback: string): string {
  const cleaned = name.replace(/[\u0000-\u001F]/g, '').trim().slice(0, 40);
  return cleaned || fallback;
}

function cleanAvatar(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('https://')) return null;
  return url.slice(0, 500);
}

const STAKES = new Set([10, 20, 50, 100]);
const INSTANTS = new Set(['dragon', 'fourTwos', 'sixPairs', 'fivePairSeq', 'fourTriples']);

export function registerAuth(
  app: Express,
  deps: { db: AppDb; secret: string; googleClientId: string | null },
): void {
  const google = deps.googleClientId ? new OAuth2Client(deps.googleClientId) : null;

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/config', (_req, res) => {
    res.json({ googleClientId: deps.googleClientId });
  });

  app.get('/api/auth/me', (req, res) => {
    const user = currentUser(req);
    res.json({ user });
  });

  app.post('/api/auth/guest', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    if (limited(ip)) {
      res.status(429).json({ message: 'Bạn tạo quá nhiều tài khoản khách. Hãy thử lại sau.' });
      return;
    }
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const user = deps.db.createGuest(`Khách ${suffix}`);
    writeSessionCookie(res, signSession(user.id, deps.secret));
    res.json({ user });
  });

  app.post('/api/auth/google', async (req, res) => {
    if (!google || !deps.googleClientId) {
      res.status(400).json({ message: 'Chưa cấu hình đăng nhập Google. Bạn có thể chơi thử bằng tài khoản khách.' });
      return;
    }
    const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
    if (!credential) {
      res.status(400).json({ message: 'Thiếu mã đăng nhập Google' });
      return;
    }
    try {
      const ticket = await google.verifyIdToken({ idToken: credential, audience: deps.googleClientId });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        res.status(401).json({ message: 'Không xác thực được tài khoản Google' });
        return;
      }
      const user = deps.db.upsertGoogle({
        sub: payload.sub,
        name: cleanName(payload.name || payload.email || '', 'Người chơi'),
        email: (payload.email || '').slice(0, 120),
        avatar: cleanAvatar(payload.picture),
      });
      writeSessionCookie(res, signSession(user.id, deps.secret));
      res.json({ user });
    } catch (error) {
      console.error('Google sign-in failed', error);
      res.status(401).json({ message: 'Không xác thực được tài khoản Google' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    writeSessionCookie(res, null);
    res.json({ ok: true });
  });

  app.post('/api/stats/solo', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      res.status(401).json({ message: 'Bạn cần đăng nhập để lưu điểm' });
      return;
    }
    const place = Number(req.body?.place);
    const playerCount = Number(req.body?.playerCount);
    const delta = Number(req.body?.delta);
    const stake = Number(req.body?.stake);
    const instant = req.body?.instant == null || req.body?.instant === '' ? null : String(req.body.instant);
    if (![2, 3, 4].includes(playerCount) || !Number.isInteger(place) || place < 1 || place > playerCount) {
      res.status(400).json({ message: 'Kết quả ván không hợp lệ' });
      return;
    }
    if (!STAKES.has(stake) || !Number.isFinite(delta) || Math.abs(delta) > stake * 40) {
      res.status(400).json({ message: 'Điểm ván không hợp lệ' });
      return;
    }
    if (instant && !INSTANTS.has(instant)) {
      res.status(400).json({ message: 'Kiểu tới trắng không hợp lệ' });
      return;
    }
    const updated = deps.db.recordMatch(user.id, {
      place,
      playerCount,
      delta,
      instant,
      mode: 'solo',
    });
    res.json({ user: updated });
  });

  function currentUser(req: Request) {
    const userId = userIdFromCookie(req.headers.cookie, deps.secret);
    if (!userId) return null;
    return deps.db.getUser(userId);
  }

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ message: 'Không tìm thấy API' });
  });
}

export function userFromCookieHeader(header: string | undefined, secret: string, db: AppDb) {
  const userId = userIdFromCookie(header, secret);
  if (!userId) return null;
  return db.getUser(userId);
}
