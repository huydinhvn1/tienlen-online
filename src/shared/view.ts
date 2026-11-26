import { comboTitle } from './combo.ts';
import { instantChopMove } from './ai.ts';
import type { Card, GameResult, GameState } from './types.ts';

export interface SeatView {
  index: number;
  name: string;
  avatar: string | null;
  isBot: boolean;
  connected: boolean;
  cardCount: number;
  place: number | null;
  passed: boolean;
}

export interface TableView {
  seats: SeatView[];
  you: number;
  yourHand: Card[];
  pile: Card[];
  pileLabel: string | null;
  pileSeat: number | null;
  currentTurn: number;
  openingCardId: string | null;
  yourTurn: boolean;
  canInstantChop: boolean;
  phase: 'playing' | 'ended';
  result: GameResult | null;
  turnSerial: number;
  turnMsLeft: number;
  turnBudgetMs: number;
  stake: number;
  instantChopRule: boolean;
  playerCount: number;
}

export function toTableView(state: GameState, you: number, now = Date.now()): TableView {
  return {
    seats: state.players.map((player, index) => ({
      index,
      name: player.name,
      avatar: player.avatar,
      isBot: player.isBot,
      connected: player.connected,
      cardCount: player.hand.length,
      place: state.finished.includes(index) ? state.finished.indexOf(index) + 1 : null,
      passed: state.phase === 'playing' && !!state.lastPlay && state.passed[index] === true,
    })),
    you,
    yourHand: state.players[you]?.hand.slice() ?? [],
    pile: state.lastPlay?.combo.cards.slice() ?? [],
    pileLabel: state.lastPlay ? comboTitle(state.lastPlay.combo) : null,
    pileSeat: state.lastPlay?.seat ?? null,
    currentTurn: state.currentTurn,
    openingCardId: state.openingCardId,
    yourTurn: state.phase === 'playing' && state.currentTurn === you,
    canInstantChop: instantChopMove(state, you) != null,
    phase: state.phase,
    result: state.result,
    turnSerial: state.turnSerial,
    turnMsLeft: state.phase === 'playing' ? Math.max(0, state.turnDeadline - now) : 0,
    turnBudgetMs: state.turnBudgetMs,
    stake: state.stake,
    instantChopRule: state.instantChop,
    playerCount: state.players.length,
  };
}
