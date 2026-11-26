import type { TableView } from './view.ts';

export interface RecentMatch {
  place: number;
  playerCount: number;
  delta: number;
  instant: string | null;
  mode: 'solo' | 'online';
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  provider: 'google' | 'guest';
  gamesPlayed: number;
  wins: number;
  chips: number;
  winStreak: number;
  bestStreak: number;
  recent: RecentMatch[];
}

export interface LobbyRoom {
  code: string;
  hostName: string;
  players: number;
  bots: number;
  status: 'waiting' | 'playing';
  stake: number;
}

export interface SeatInfo {
  index: number;
  name: string;
  avatar: string | null;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  left: boolean;
}

export interface RoomSnapshot {
  code: string;
  phase: 'lobby' | 'table';
  hostId: string;
  you: number;
  stake: number;
  instantChop: boolean;
  seats: SeatInfo[];
  table: TableView | null;
  feed: string[];
}

export interface ClientConfig {
  googleClientId: string | null;
}
