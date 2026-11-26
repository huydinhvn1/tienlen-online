import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { PublicUser, RecentMatch } from '../shared/protocol.ts';

interface UserRow {
  id: string;
  provider: string;
  name: string;
  email: string;
  avatar: string | null;
  games_played: number;
  wins: number;
  chips: number;
  win_streak: number;
  best_streak: number;
}

export interface MatchInput {
  place: number;
  playerCount: number;
  delta: number;
  instant: string | null;
  mode: 'solo' | 'online';
}

export interface AppDb {
  getUser(id: string): PublicUser | null;
  createGuest(name: string): PublicUser;
  upsertGoogle(input: { sub: string; name: string; email: string; avatar: string | null }): PublicUser;
  recordMatch(userId: string, match: MatchInput): PublicUser | null;
}

function asUser(row: UserRow, recent: RecentMatch[]): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    provider: row.provider === 'google' ? 'google' : 'guest',
    gamesPlayed: Number(row.games_played) || 0,
    wins: Number(row.wins) || 0,
    chips: Number(row.chips) || 0,
    winStreak: Number(row.win_streak) || 0,
    bestStreak: Number(row.best_streak) || 0,
    recent,
  };
}

export function initDb(dir: string): AppDb {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'tienlen.sqlite'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      avatar TEXT,
      games_played INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      chips INTEGER NOT NULL DEFAULT 1000,
      win_streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      place INTEGER NOT NULL,
      player_count INTEGER NOT NULL,
      chips_delta INTEGER NOT NULL,
      instant_win TEXT,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS matches_user ON matches(user_id, id DESC);
  `);

  const selectUser = db.prepare('SELECT * FROM users WHERE id = ?');
  const selectRecent = db.prepare(
    'SELECT place, player_count, chips_delta, instant_win, mode, created_at FROM matches WHERE user_id = ? ORDER BY id DESC LIMIT 8',
  );
  const insertGuest = db.prepare(
    `INSERT INTO users (id, provider, name, email, avatar, created_at, updated_at)
     VALUES (?, 'guest', ?, '', NULL, ?, ?)`,
  );
  const upsertGoogle = db.prepare(
    `INSERT INTO users (id, provider, name, email, avatar, created_at, updated_at)
     VALUES (?, 'google', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       email = excluded.email,
       avatar = excluded.avatar,
       updated_at = excluded.updated_at`,
  );
  const insertMatch = db.prepare(
    `INSERT INTO matches (user_id, place, player_count, chips_delta, instant_win, mode, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const updateStats = db.prepare(
    `UPDATE users
     SET games_played = ?, wins = ?, chips = ?, win_streak = ?, best_streak = ?, updated_at = ?
     WHERE id = ?`,
  );

  function recentOf(userId: string): RecentMatch[] {
    const rows = selectRecent.all(userId) as Array<{
      place: number;
      player_count: number;
      chips_delta: number;
      instant_win: string | null;
      mode: string;
      created_at: string;
    }>;
    return rows.map((row) => ({
      place: Number(row.place),
      playerCount: Number(row.player_count),
      delta: Number(row.chips_delta),
      instant: row.instant_win,
      mode: row.mode === 'online' ? 'online' : 'solo',
      createdAt: row.created_at,
    }));
  }

  function load(id: string): PublicUser | null {
    const row = selectUser.get(id) as UserRow | undefined;
    if (!row) return null;
    return asUser(row, recentOf(id));
  }

  return {
    getUser: load,
    createGuest(name: string) {
      const now = new Date().toISOString();
      const id = `guest:${randomUUID()}`;
      insertGuest.run(id, name, now, now);
      return load(id)!;
    },
    upsertGoogle(input) {
      const now = new Date().toISOString();
      const id = `g:${input.sub}`;
      upsertGoogle.run(id, input.name, input.email, input.avatar, now, now);
      return load(id)!;
    },
    recordMatch(userId, match) {
      const row = selectUser.get(userId) as UserRow | undefined;
      if (!row) return null;
      const now = new Date().toISOString();
      const win = match.place === 1;
      const streak = win ? Number(row.win_streak) + 1 : 0;
      const chips = Math.max(0, Number(row.chips) + match.delta);
      db.exec('BEGIN');
      try {
        insertMatch.run(userId, match.place, match.playerCount, match.delta, match.instant, match.mode, now);
        updateStats.run(
          Number(row.games_played) + 1,
          Number(row.wins) + (win ? 1 : 0),
          chips,
          streak,
          Math.max(Number(row.best_streak), streak),
          now,
          userId,
        );
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return load(userId);
    },
  };
}
