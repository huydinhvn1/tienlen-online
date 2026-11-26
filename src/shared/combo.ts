import { groupByRank, sortCards, suitIndex } from './cards.ts';
import type { Card, Combo, ComboKind } from './types.ts';

function maxSuit(cards: readonly Card[]): number {
  return Math.max(...cards.map((card) => suitIndex(card.suit)));
}

function build(kind: ComboKind, cards: Card[], rank: number, suit: number): Combo {
  return { kind, cards, rank, suit, length: cards.length };
}

/** Identify a set of cards as one valid Tiến Lên combination, or null. */
export function identify(input: readonly Card[]): Combo | null {
  if (input.length === 0) return null;
  const seen = new Set<string>();
  for (const card of input) {
    if (seen.has(card.id)) return null;
    seen.add(card.id);
  }
  const cards = sortCards(input);
  const n = cards.length;
  const ranks = cards.map((card) => card.rank);
  const allSame = ranks.every((rank) => rank === ranks[0]);

  if (n === 1) return build('single', cards, cards[0]!.rank, suitIndex(cards[0]!.suit));
  if (n === 2 && allSame) return build('pair', cards, ranks[0]!, maxSuit(cards));
  if (n === 3 && allSame) return build('triple', cards, ranks[0]!, maxSuit(cards));
  if (n === 4 && allSame) return build('fourKind', cards, ranks[0]!, maxSuit(cards));

  const unique = new Set(ranks);
  if (unique.size === n && n >= 3 && !ranks.includes(15)) {
    const ordered = [...unique].sort((a, b) => a - b);
    let consecutive = true;
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i] !== ordered[i - 1]! + 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      const top = cards[cards.length - 1]!;
      return build('straight', cards, top.rank, suitIndex(top.suit));
    }
  }

  if (n === 6 || n === 8) {
    const groups = groupByRank(cards);
    const sizesOk = [...groups.values()].every((group) => group.length === 2);
    const rs = [...groups.keys()].sort((a, b) => a - b);
    if (sizesOk && rs.length === n / 2 && !rs.includes(15)) {
      let consecutive = true;
      for (let i = 1; i < rs.length; i++) {
        if (rs[i] !== rs[i - 1]! + 1) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) {
        const topRank = rs[rs.length - 1]!;
        const kind: ComboKind = n === 6 ? 'pairSeq3' : 'pairSeq4';
        return build(kind, cards, topRank, maxSuit(groups.get(topRank)!));
      }
    }
  }

  return null;
}

export function comboKey(combo: Combo): number {
  return combo.rank * 10 + combo.suit;
}

function sameShape(a: Combo, b: Combo): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'straight') return a.length === b.length;
  return true;
}

/** Cross-kind chops. Same-kind comparisons are handled by comboKey. */
export function chops(attack: Combo, target: Combo): boolean {
  if (attack.kind === 'pairSeq3') {
    return target.kind === 'single' && target.rank === 15;
  }
  if (attack.kind === 'fourKind') {
    if (target.kind === 'single' && target.rank === 15) return true;
    if (target.kind === 'pair' && target.rank === 15) return true;
    if (target.kind === 'pairSeq3') return true;
    return false;
  }
  if (attack.kind === 'pairSeq4') {
    if (target.kind === 'single' && target.rank === 15) return true;
    if (target.kind === 'pair' && target.rank === 15) return true;
    if (target.kind === 'pairSeq3') return true;
    if (target.kind === 'fourKind') return true;
    return false;
  }
  return false;
}

export function canBeat(next: Combo, prev: Combo | null): boolean {
  if (!prev) return true;
  if (sameShape(next, prev)) return comboKey(next) > comboKey(prev);
  return chops(next, prev);
}

export function isBomb(combo: Combo): boolean {
  return combo.kind === 'fourKind' || combo.kind === 'pairSeq3' || combo.kind === 'pairSeq4';
}

export function playToast(combo: Combo, prev: Combo | null): string | null {
  const beatingTwo =
    !!prev &&
    (prev.kind === 'single' || prev.kind === 'pair') &&
    prev.rank === 15 &&
    combo.kind !== prev.kind &&
    canBeat(combo, prev);
  if (beatingTwo) return 'Chặt Heo!';
  if (combo.kind === 'fourKind') return 'Tứ Quý!';
  if (combo.kind === 'pairSeq3') return '3 Đôi Thông!';
  if (combo.kind === 'pairSeq4') return '4 Đôi Thông!';
  return null;
}

export function comboTitle(combo: Combo): string {
  const rank = combo.cards.length > 0 ? labelRank(combo.rank) : '';
  switch (combo.kind) {
    case 'single':
      return `Lẻ ${labelCard(combo)}`;
    case 'pair':
      return `Đôi ${rank}`;
    case 'triple':
      return `Sám ${rank}`;
    case 'straight':
      return `Sảnh ${combo.length}`;
    case 'fourKind':
      return `Tứ quý ${rank}`;
    case 'pairSeq3':
      return '3 đôi thông';
    case 'pairSeq4':
      return '4 đôi thông';
  }
}

function labelRank(rank: number): string {
  const map: Record<number, string> = {
    3: '3',
    4: '4',
    5: '5',
    6: '6',
    7: '7',
    8: '8',
    9: '9',
    10: '10',
    11: 'J',
    12: 'Q',
    13: 'K',
    14: 'A',
    15: '2',
  };
  return map[rank] ?? String(rank);
}

function labelCard(combo: Combo): string {
  const card = combo.cards[0];
  if (!card) return labelRank(combo.rank);
  const suits = ['♠', '♣', '♦', '♥'] as const;
  return `${labelRank(card.rank)}${suits[['S', 'C', 'D', 'H'].indexOf(card.suit)] ?? ''}`;
}

function combinations<T>(arr: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, picked: T[]) => {
    if (picked.length === k) {
      out.push(picked.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) walk(i + 1, [...picked, arr[i]!]);
  };
  walk(0, []);
  return out;
}

function cartesian<T>(groups: T[][]): T[][] {
  let acc: T[][] = [[]];
  for (const group of groups) {
    const next: T[][] = [];
    for (const prefix of acc) {
      for (const item of group) next.push([...prefix, item]);
    }
    acc = next;
    if (acc.length > 4000) return acc;
  }
  return acc;
}

/** Every valid combination that can be formed from a hand. */
export function listCombos(hand: readonly Card[]): Combo[] {
  const byRank = groupByRank(hand);
  const out: Combo[] = [];
  const seen = new Set<string>();
  const push = (cards: Card[]) => {
    const combo = identify(cards);
    if (!combo) return;
    const key = combo.cards.map((card) => card.id).join('.');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(combo);
  };

  for (const card of hand) push([card]);

  for (const group of byRank.values()) {
    if (group.length >= 2) for (const pair of combinations(group, 2)) push(pair);
    if (group.length >= 3) for (const triple of combinations(group, 3)) push(triple);
    if (group.length === 4) push(group.slice());
  }

  for (let length = 3; length <= 12; length++) {
    for (let start = 3; start <= 14 - length + 1; start++) {
      const ranks: number[] = [];
      let ok = true;
      for (let k = 0; k < length; k++) {
        const rank = start + k;
        if (!byRank.has(rank)) {
          ok = false;
          break;
        }
        ranks.push(rank);
      }
      if (!ok) continue;
      const groups = ranks.map((rank) => byRank.get(rank)!);
      for (const choice of cartesian(groups)) push(choice);
    }
  }

  for (const needed of [3, 4]) {
    for (let start = 3; start <= 14 - needed + 1; start++) {
      const ranks: number[] = [];
      let ok = true;
      for (let k = 0; k < needed; k++) {
        const rank = start + k;
        if ((byRank.get(rank)?.length ?? 0) < 2) {
          ok = false;
          break;
        }
        ranks.push(rank);
      }
      if (!ok) continue;
      const choices = ranks.map((rank) => combinations(byRank.get(rank)!, 2));
      for (const picked of cartesian(choices)) push(picked.flat());
    }
  }

  return out;
}
