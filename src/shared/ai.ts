import { canBeat, comboKey, isBomb, listCombos } from './combo.ts';
import type { Combo, GameState } from './types.ts';
import { legalMoves } from './game.ts';

export interface AiMove {
  type: 'play' | 'pass';
  cardIds: string[];
}

function averageRank(combo: Combo): number {
  const total = combo.cards.reduce((sum, card) => sum + card.rank, 0);
  return total / combo.cards.length;
}

function threat(state: GameState, seat: number): number {
  let min = 99;
  state.players.forEach((player, index) => {
    if (index === seat || state.finished.includes(index)) return;
    min = Math.min(min, player.hand.length);
  });
  return min;
}

function leadScore(combo: Combo, handSize: number): number {
  const avg = averageRank(combo);
  const lengthWeight = avg > 10 ? 4 : 9;
  let score = combo.cards.length * lengthWeight - avg * 1.6;
  if (combo.cards.some((card) => card.rank === 15)) score -= 70;
  if (isBomb(combo)) score -= 36;
  if (combo.kind === 'straight' && avg <= 10) score += 6;
  if (combo.cards.length === handSize) score += 500;
  return score;
}

function beatCost(combo: Combo, handSize: number, danger: number): number {
  let cost = averageRank(combo) * 3 + combo.suit * 0.2;
  if (combo.cards.some((card) => card.rank === 15)) cost += 36;
  if (isBomb(combo)) cost += danger <= 3 ? -8 : 28;
  if (combo.cards.length === handSize) cost -= 1000;
  cost -= combo.cards.length * 0.4;
  return cost;
}

function mustAnswer(state: GameState): boolean {
  const target = state.lastPlay?.combo;
  if (!target) return false;
  if (target.rank === 15 && (target.kind === 'single' || target.kind === 'pair')) return true;
  return isBomb(target);
}

export function chooseAiMove(state: GameState, seat: number): AiMove {
  const moves = legalMoves(state, seat);
  const handSize = state.players[seat]?.hand.length ?? 0;
  if (moves.length === 0) return { type: 'pass', cardIds: [] };

  const winningDump = moves.find((combo) => combo.cards.length === handSize);
  if (winningDump) return { type: 'play', cardIds: winningDump.cards.map((card) => card.id) };

  if (!state.lastPlay) {
    const ranked = moves.slice().sort((a, b) => leadScore(b, handSize) - leadScore(a, handSize));
    const pick = ranked[0]!;
    return { type: 'play', cardIds: pick.cards.map((card) => card.id) };
  }

  if (!mustAnswer(state) && moves.every(isBomb)) {
    const danger = threat(state, seat);
    if (danger > 3 && handSize > 4) return { type: 'pass', cardIds: [] };
  }

  const danger = threat(state, seat);
  const ranked = moves.slice().sort((a, b) => beatCost(a, handSize, danger) - beatCost(b, handSize, danger));
  const pick = ranked[0]!;
  return { type: 'play', cardIds: pick.cards.map((card) => card.id) };
}

/** Smallest 4 đôi thông that can chop out of turn, if the rule is on and this seat has not passed. */
export function instantChopMove(state: GameState, seat: number): string[] | null {
  if (!state.instantChop || state.phase !== 'playing' || !state.lastPlay) return null;
  if (state.currentTurn === seat) return null;
  if (state.finished.includes(seat) || state.passed[seat]) return null;
  if (state.lastPlay.seat === seat) return null;
  const player = state.players[seat];
  if (!player) return null;
  const bombs = listCombos(player.hand).filter(
    (combo) => combo.kind === 'pairSeq4' && canBeat(combo, state.lastPlay!.combo),
  );
  if (bombs.length === 0) return null;
  bombs.sort((a, b) => comboKey(a) - comboKey(b));
  return bombs[0]!.cards.map((card) => card.id);
}
