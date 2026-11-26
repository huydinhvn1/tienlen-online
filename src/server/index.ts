import './quiet.ts';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import { dataDir, googleClientId, listenPort, loadEnvFile, sessionSecret } from './config.ts';
import { initDb } from './db.ts';
import { registerAuth, userFromCookieHeader } from './auth.ts';
import { attachSockets } from './rooms.ts';

loadEnvFile();

const secret = sessionSecret();
const clientId = googleClientId();
const db = initDb(dataDir());
const port = listenPort();
const prod = process.env.NODE_ENV === 'production';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
registerAuth(app, { db, secret, googleClientId: clientId });

const httpServer = createServer(app);
const io = new Server(httpServer);
attachSockets(io, db, (cookie) => userFromCookieHeader(cookie, secret, db));

if (!prod) {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const clientDir = path.resolve('dist/client');
  app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Bài Tiến Lên đang lắng nghe 0.0.0.0:${port}`);
});
