export type Suit = 'S' | 'C' | 'D' | 'H';

export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export type ComboKind =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'fourKind'
  | 'pairSeq3'
  | 'pairSeq4';

export interface Combo {
  kind: ComboKind;
  cards: Card[];
  /** Highest rank that decides the combo. */
  rank: number;
  /** Suit index (0–3) of the deciding card. */
  suit: number;
  length: number;
}

export type InstantType = 'dragon' | 'fourTwos' | 'sixPairs' | 'fivePairSeq' | 'fourTriples';

export interface ScoreLine {
  seat: number;
  place: number;
  label: string;
  delta: number;
  notes: string[];
}

export interface GameResult {
  scores: ScoreLine[];
  instant: { type: InstantType; label: string; seat: number } | null;
  revealHands: Card[][];
}

export interface PlayerState {
  id: string;
  name: string;
  avatar: string | null;
  isBot: boolean;
  connected: boolean;
  hand: Card[];
}

export interface LastPlay {
  seat: number;
  combo: Combo;
}

export interface GameState {
  players: PlayerState[];
  currentTurn: number;
  lastPlay: LastPlay | null;
  passed: boolean[];
  /** Seats in the order they finished. The last entry is Bét once the game ends. */
  finished: number[];
  phase: 'playing' | 'ended';
  /** Card that must be part of the opening lead. Null after the first play, or when the previous winner leads. */
  openingCardId: string | null;
  instantChop: boolean;
  stake: number;
  result: GameResult | null;
  turnSerial: number;
  turnDeadline: number;
  turnBudgetMs: number;
}

export type GameEvent =
  | { type: 'play'; seat: number; combo: Combo; toast: string | null }
  | { type: 'pass'; seat: number }
  | { type: 'round'; seat: number }
  | { type: 'finish'; seat: number; place: number }
  | { type: 'end' };

export type MoveResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };
