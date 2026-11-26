import { groupByRank } from './cards.ts';
import { INSTANT_LABEL } from './instant.ts';
import type { Card, GameResult, InstantType, ScoreLine } from './types.ts';

const MULTIPLIERS: Record<number, number[]> = {
  2: [2, -2],
  3: [2, 0, -2],
  4: [3, 1, -1, -3],
};

export function placeLabel(place: number, total: number): string {
  if (place === 1) return 'Nhất';
  if (total === 2) return 'Bét';
  if (total === 3) return place === 2 ? 'Nhì' : 'Bét';
  return ['Nhất', 'Nhì', 'Ba', 'Bét'][place - 1] ?? 'Bét';
}

function hasPairRun(cards: readonly Card[], needed: number): boolean {
  const groups = groupByRank(cards);
  const ranks = [...groups.keys()].filter((rank) => rank <= 14 && (groups.get(rank)?.length ?? 0) >= 2);
  const set = new Set(ranks);
  for (let start = 3; start <= 14 - needed + 1; start++) {
    let ok = true;
    for (let k = 0; k < needed; k++) {
      if (!set.has(start + k)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function hasFour(cards: readonly Card[]): boolean {
  for (const group of groupByRank(cards).values()) {
    if (group.length === 4) return true;
  }
  return false;
}

export function scoreMatch(input: {
  finished: number[];
  hands: Card[][];
  stake: number;
  instant: { type: InstantType; seat: number } | null;
}): GameResult {
  const count = input.hands.length;
  const stake = input.stake;
  const revealHands = input.hands.map((hand) => hand.slice());

  if (input.instant) {
    const scores: ScoreLine[] = input.hands.map((_, seat) => {
      if (seat === input.instant!.seat) {
        return {
          seat,
          place: 1,
          label: 'Nhất',
          delta: 5 * stake * (count - 1),
          notes: [`Tới trắng · ${INSTANT_LABEL[input.instant!.type]}`],
        };
      }
      return {
        seat,
        place: count,
        label: 'Thua',
        delta: -5 * stake,
        notes: ['Tới trắng'],
      };
    });
    return {
      scores,
      instant: {
        type: input.instant.type,
        label: INSTANT_LABEL[input.instant.type],
        seat: input.instant.seat,
      },
      revealHands,
    };
  }

  const placeOf = new Map<number, number>();
  input.finished.forEach((seat, index) => placeOf.set(seat, index + 1));
  const mults = MULTIPLIERS[count] ?? MULTIPLIERS[4]!;
  const lastSeat = input.finished[input.finished.length - 1] ?? 0;
  const leftover = input.hands[lastSeat] ?? [];
  const twos = leftover.filter((card) => card.rank === 15).length;
  const bombLeft = hasFour(leftover) || hasPairRun(leftover, 3);
  const penalty = (twos + (bombLeft ? 2 : 0)) * stake;
  const winner = input.finished[0] ?? 0;

  const scores: ScoreLine[] = input.hands.map((_, seat) => {
    const place = placeOf.get(seat) ?? count;
    const notes: string[] = [];
    let delta = (mults[place - 1] ?? 0) * stake;
    if (seat === lastSeat && penalty) {
      delta -= penalty;
      if (twos) notes.push(twos === 1 ? 'Thối 1 heo' : `Thối ${twos} heo`);
      if (bombLeft) notes.push('Thối tứ quý hoặc đôi thông');
    }
    if (seat === winner && penalty) {
      delta += penalty;
      notes.push('Ăn thối');
    }
    return {
      seat,
      place,
      label: placeLabel(place, count),
      delta,
      notes,
    };
  });

  return { scores, instant: null, revealHands };
}
