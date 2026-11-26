import { groupByRank } from './cards.ts';
import type { Card, InstantType } from './types.ts';

export const INSTANT_ORDER: readonly InstantType[] = [
  'dragon',
  'fourTwos',
  'sixPairs',
  'fivePairSeq',
  'fourTriples',
] as const;

export const INSTANT_LABEL: Record<InstantType, string> = {
  dragon: 'Sảnh rồng',
  fourTwos: 'Tứ quý 2',
  sixPairs: '6 đôi',
  fivePairSeq: '5 đôi thông',
  fourTriples: '4 sám cô',
};

export function detectInstant(hand: readonly Card[]): InstantType | null {
  for (const type of INSTANT_ORDER) {
    if (matchesInstant(hand, type)) return type;
  }
  return null;
}

export function matchesInstant(hand: readonly Card[], type: InstantType): boolean {
  const groups = groupByRank(hand);
  if (type === 'dragon') {
    for (let rank = 3; rank <= 14; rank++) {
      if (!groups.has(rank)) return false;
    }
    return true;
  }
  if (type === 'fourTwos') return (groups.get(15)?.length ?? 0) === 4;
  if (type === 'sixPairs') {
    let pairs = 0;
    for (const group of groups.values()) pairs += Math.floor(group.length / 2);
    return pairs >= 6;
  }
  if (type === 'fivePairSeq') {
    const pairRanks = new Set<number>();
    for (const [rank, group] of groups) {
      if (rank <= 14 && group.length >= 2) pairRanks.add(rank);
    }
    for (let start = 3; start <= 10; start++) {
      let ok = true;
      for (let k = 0; k < 5; k++) {
        if (!pairRanks.has(start + k)) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  }
  let triples = 0;
  for (const group of groups.values()) if (group.length >= 3) triples += 1;
  return triples >= 4;
}
