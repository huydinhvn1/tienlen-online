import type { Card, Rank, Suit } from './types.ts';

export const SUITS: readonly Suit[] = ['S', 'C', 'D', 'H'] as const;

export const RANKS: readonly Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export const RANK_LABEL: Record<Rank, string> = {
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

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: '♠',
  C: '♣',
  D: '♦',
  H: '♥',
};

export const SUIT_NAME: Record<Suit, string> = {
  S: 'Bích',
  C: 'Chuồn',
  D: 'Rô',
  H: 'Cơ',
};

const RANK_BY_LABEL: Record<string, Rank> = {
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  '2': 15,
};

export function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'D' || suit === 'H';
}

export function makeCard(rank: Rank, suit: Suit): Card {
  return { id: `${RANK_LABEL[rank]}${suit}`, rank, suit };
}

export function parseCard(code: string): Card {
  const suit = code.slice(-1) as Suit;
  if (!SUITS.includes(suit)) throw new Error(`Chất không hợp lệ: ${code}`);
  const label = code.slice(0, -1);
  const rank = RANK_BY_LABEL[label];
  if (!rank) throw new Error(`Nước không hợp lệ: ${code}`);
  return makeCard(rank, suit);
}

export function parseCards(spec: string): Card[] {
  return spec
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseCard);
}

export function cardLabel(card: Card): string {
  return `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit]}`;
}

export function cardSpeech(card: Card): string {
  return `${RANK_LABEL[card.rank]} ${SUIT_NAME[card.suit]}`;
}

export function compareCards(a: Card, b: Card): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  return suitIndex(a.suit) - suitIndex(b.suit);
}

export function sortCards(cards: readonly Card[]): Card[] {
  return cards.slice().sort(compareCards);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(makeCard(rank, suit));
  }
  return deck;
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function groupByRank(cards: readonly Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>();
  for (const card of cards) {
    const list = map.get(card.rank);
    if (list) list.push(card);
    else map.set(card.rank, [card]);
  }
  return map;
}

export type SortMode = 'rank' | 'suit' | 'group';

export function sortHand(cards: readonly Card[], mode: SortMode): Card[] {
  const arr = cards.slice();
  if (mode === 'suit') {
    return arr.sort((a, b) => suitIndex(a.suit) - suitIndex(b.suit) || a.rank - b.rank);
  }
  if (mode === 'group') {
    const groups = groupByRank(arr);
    const ranks = [...groups.keys()].sort((a, b) => {
      const sizeA = groups.get(a)!.length;
      const sizeB = groups.get(b)!.length;
      const setA = sizeA >= 2 ? 1 : 0;
      const setB = sizeB >= 2 ? 1 : 0;
      if (setA !== setB) return setB - setA;
      return a - b;
    });
    return ranks.flatMap((rank) => groups.get(rank)!.slice().sort(compareCards));
  }
  return arr.sort(compareCards);
}
