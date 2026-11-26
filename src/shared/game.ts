import { canBeat, comboTitle, identify, listCombos, playToast } from './combo.ts';
import { cardLabel, compareCards, createDeck, parseCard, shuffle, sortCards } from './cards.ts';
import { detectInstant } from './instant.ts';
import { placeLabel, scoreMatch } from './scoring.ts';
import type { Card, Combo, GameEvent, GameState, MoveResult, PlayerState } from './types.ts';

const TURN_MS = 30_000;

export interface DealOptions {
  hands?: Card[][];
  playerCount?: number;
  rng?: () => number;
  stake?: number;
  instantChop?: boolean;
  names?: string[];
  avatars?: (string | null)[];
  bots?: boolean[];
  ids?: string[];
  /** Previous winner leads freely, without the 3♠ requirement. */
  leaderSeat?: number | null;
  opening?: 'auto' | 'none';
  connected?: boolean[];
}

function fail(error: string): MoveResult {
  return { ok: false, error };
}

function uniqueOrThrow(hands: Card[][]): void {
  const ids = hands.flat().map((card) => card.id);
  if (new Set(ids).size !== ids.length) throw new Error('Bộ bài có lá trùng');
  if (hands.some((hand) => hand.length === 0)) throw new Error('Tay bài trống');
}

function openingInfo(hands: Card[][], opts: DealOptions): { leader: number; openingCardId: string | null } {
  if (opts.leaderSeat != null && opts.leaderSeat >= 0 && opts.leaderSeat < hands.length) {
    return { leader: opts.leaderSeat, openingCardId: null };
  }
  if (opts.opening === 'none') return { leader: 0, openingCardId: null };
  for (let seat = 0; seat < hands.length; seat++) {
    if (hands[seat]!.some((card) => card.id === '3S')) return { leader: seat, openingCardId: '3S' };
  }
  let bestSeat = 0;
  let best = hands[0]![0]!;
  hands.forEach((hand, seat) => {
    for (const card of hand) {
      if (compareCards(card, best) < 0) {
        best = card;
        bestSeat = seat;
      }
    }
  });
  return { leader: bestSeat, openingCardId: best.id };
}

export function dealGame(opts: DealOptions = {}): GameState {
  const count = opts.hands?.length ?? opts.playerCount ?? 4;
  if (count < 2 || count > 4) throw new Error('Ván bài cần từ 2 đến 4 người');
  let hands: Card[][];
  if (opts.hands) {
    hands = opts.hands.map((hand) => sortCards(hand));
  } else {
    const deck = shuffle(createDeck(), opts.rng);
    hands = Array.from({ length: count }, (_, index) => sortCards(deck.slice(index * 13, index * 13 + 13)));
  }
  uniqueOrThrow(hands);

  const players: PlayerState[] = hands.map((hand, index) => ({
    id: opts.ids?.[index] ?? `p${index}`,
    name: opts.names?.[index] ?? `Người chơi ${index + 1}`,
    avatar: opts.avatars?.[index] ?? null,
    isBot: opts.bots?.[index] ?? false,
    connected: opts.connected?.[index] ?? true,
    hand,
  }));

  const stake = opts.stake ?? 20;
  const instantChop = opts.instantChop ?? true;
  const found = players
    .map((player, seat) => ({ seat, type: detectInstant(player.hand) }))
    .filter((item): item is { seat: number; type: NonNullable<typeof item.type> } => item.type != null)
    .sort((a, b) => {
      const order = ['dragon', 'fourTwos', 'sixPairs', 'fivePairSeq', 'fourTriples'];
      const diff = order.indexOf(a.type) - order.indexOf(b.type);
      return diff !== 0 ? diff : a.seat - b.seat;
    });

  const base: GameState = {
    players,
    currentTurn: 0,
    lastPlay: null,
    passed: players.map(() => false),
    finished: [],
    phase: 'playing',
    openingCardId: null,
    instantChop,
    stake,
    result: null,
    turnSerial: 1,
    turnDeadline: Date.now() + TURN_MS,
    turnBudgetMs: TURN_MS,
  };

  if (found[0]) {
    const winner = found[0];
    const finished = [winner.seat, ...players.map((_, seat) => seat).filter((seat) => seat !== winner.seat)];
    return {
      ...base,
      phase: 'ended',
      currentTurn: -1,
      finished,
      result: scoreMatch({
        finished,
        hands: players.map((player) => player.hand),
        stake,
        instant: winner,
      }),
    };
  }

  const opening = openingInfo(hands, opts);
  return { ...base, currentTurn: opening.leader, openingCardId: opening.openingCardId };
}

function endGame(state: GameState, events: GameEvent[]): GameState {
  let finished = state.finished.slice();
  if (finished.length < state.players.length) {
    const rest = state.players.map((_, seat) => seat).filter((seat) => !finished.includes(seat));
    finished = [...finished, ...rest];
  }
  events.push({ type: 'end' });
  return {
    ...state,
    finished,
    phase: 'ended',
    currentTurn: -1,
    result: scoreMatch({
      finished,
      hands: state.players.map((player) => player.hand),
      stake: state.stake,
      instant: null,
    }),
  };
}

function nextActive(state: GameState, from: number): number {
  const count = state.players.length;
  for (let step = 1; step <= count; step++) {
    const seat = (from + step) % count;
    if (!state.finished.includes(seat)) return seat;
  }
  return from;
}

function isRoundOver(state: GameState): boolean {
  if (!state.lastPlay) return false;
  const leader = state.lastPlay.seat;
  let others = 0;
  for (let seat = 0; seat < state.players.length; seat++) {
    if (seat === leader || state.finished.includes(seat)) continue;
    others += 1;
    if (!state.passed[seat]) return false;
  }
  return others > 0;
}

function nextSeat(state: GameState, from: number): number | null {
  const count = state.players.length;
  for (let step = 1; step <= count; step++) {
    const seat = (from + step) % count;
    if (state.finished.includes(seat)) continue;
    if (state.passed[seat]) continue;
    if (state.lastPlay && seat === state.lastPlay.seat) continue;
    return seat;
  }
  return null;
}

function startRound(state: GameState, events: GameEvent[]): GameState {
  let leader = state.lastPlay?.seat ?? state.currentTurn;
  if (state.finished.includes(leader)) leader = nextActive(state, leader);
  events.push({ type: 'round', seat: leader });
  return {
    ...state,
    passed: state.passed.map(() => false),
    lastPlay: null,
    currentTurn: leader,
    turnSerial: state.turnSerial + 1,
    turnDeadline: Date.now() + TURN_MS,
    turnBudgetMs: TURN_MS,
  };
}

function advance(state: GameState, from: number, events: GameEvent[]): GameState {
  if (state.finished.length >= state.players.length - 1) return endGame(state, events);
  if (isRoundOver(state)) return startRound(state, events);
  const next = nextSeat(state, from);
  if (next == null) return startRound(state, events);
  return {
    ...state,
    currentTurn: next,
    turnSerial: state.turnSerial + 1,
    turnDeadline: Date.now() + TURN_MS,
    turnBudgetMs: TURN_MS,
  };
}

function replaceHand(state: GameState, seat: number, hand: Card[]): GameState {
  return {
    ...state,
    players: state.players.map((player, index) => (index === seat ? { ...player, hand } : player)),
  };
}

export function isInstantChop(state: GameState, seat: number, combo: Combo): boolean {
  if (!state.instantChop || state.phase !== 'playing' || !state.lastPlay) return false;
  if (state.currentTurn === seat) return false;
  if (state.finished.includes(seat) || state.passed[seat]) return false;
  if (state.lastPlay.seat === seat) return false;
  return combo.kind === 'pairSeq4' && canBeat(combo, state.lastPlay.combo);
}

export function legalMoves(state: GameState, seat: number): Combo[] {
  if (state.phase !== 'playing') return [];
  const player = state.players[seat];
  if (!player || state.finished.includes(seat) || state.passed[seat]) return [];
  return listCombos(player.hand).filter((combo) => canPlayCombo(state, seat, combo));
}

function canPlayCombo(state: GameState, seat: number, combo: Combo): boolean {
  if (state.openingCardId && !combo.cards.some((card) => card.id === state.openingCardId)) return false;
  const yourTurn = state.currentTurn === seat;
  if (!yourTurn) return isInstantChop(state, seat, combo);
  if (!state.lastPlay) return true;
  return canBeat(combo, state.lastPlay.combo);
}

export function playCards(state: GameState, seat: number, cardIds: readonly string[]): MoveResult {
  if (state.phase !== 'playing') return fail('Ván bài đã kết thúc');
  const player = state.players[seat];
  if (!player) return fail('Người chơi không tồn tại');
  if (state.finished.includes(seat)) return fail('Bạn đã về');
  if (cardIds.length === 0) return fail('Chọn ít nhất một lá bài');

  const picked: Card[] = [];
  for (const id of cardIds) {
    if (picked.some((card) => card.id === id)) return fail('Bài bị trùng');
    const card = player.hand.find((item) => item.id === id);
    if (!card) return fail('Bài không có trong tay');
    picked.push(card);
  }
  const combo = identify(picked);
  if (!combo) return fail('Bộ bài không hợp lệ');
  if (state.passed[seat]) return fail('Bạn đã bỏ lượt vòng này');

  const yourTurn = state.currentTurn === seat;
  const choppingNow = !yourTurn && isInstantChop(state, seat, combo);
  if (!yourTurn && !choppingNow) return fail('Chưa tới lượt bạn');
  if (state.openingCardId && !cardIds.includes(state.openingCardId)) {
    return fail(`Lượt đầu phải có ${cardLabel(parseCard(state.openingCardId))}`);
  }
  if (state.lastPlay && !canBeat(combo, state.lastPlay.combo)) return fail('Chưa đủ mạnh để chặt');

  const idSet = new Set(cardIds);
  let next = replaceHand(
    state,
    seat,
    player.hand.filter((card) => !idSet.has(card.id)),
  );
  const events: GameEvent[] = [
    { type: 'play', seat, combo, toast: playToast(combo, state.lastPlay?.combo ?? null) },
  ];
  let finished = state.finished.slice();
  if (next.players[seat]!.hand.length === 0) {
    finished = [...finished, seat];
    events.push({ type: 'finish', seat, place: finished.length });
  }
  next = {
    ...next,
    finished,
    lastPlay: { seat, combo },
    openingCardId: null,
  };
  if (finished.length >= next.players.length - 1) {
    return { ok: true, state: endGame(next, events), events };
  }
  return { ok: true, state: advance(next, seat, events), events };
}

export function passTurn(state: GameState, seat: number): MoveResult {
  if (state.phase !== 'playing') return fail('Ván bài đã kết thúc');
  if (state.currentTurn !== seat) return fail('Chưa tới lượt bạn');
  if (state.finished.includes(seat)) return fail('Bạn đã về');
  if (state.passed[seat]) return fail('Bạn đã bỏ lượt vòng này');
  if (!state.lastPlay) return fail('Bạn đang dẫn lượt, hãy đánh bài');
  const passed = state.passed.slice();
  passed[seat] = true;
  const events: GameEvent[] = [{ type: 'pass', seat }];
  return { ok: true, state: advance({ ...state, passed }, seat, events), events };
}

export function eventText(event: GameEvent, names: readonly string[], playerCount: number): string | null {
  switch (event.type) {
    case 'play':
      return `${names[event.seat] ?? 'Người chơi'} đánh ${comboTitle(event.combo)}`;
    case 'pass':
      return `${names[event.seat] ?? 'Người chơi'} bỏ lượt`;
    case 'round':
      return `Vòng mới — ${names[event.seat] ?? 'Người chơi'} đi trước`;
    case 'finish':
      return `${names[event.seat] ?? 'Người chơi'} về ${placeLabel(event.place, playerCount)}`;
    case 'end':
      return 'Kết thúc ván bài';
    default:
      return null;
  }
}

export interface PlayPreview {
  ok: boolean;
  text: string;
}

export function previewPlay(
  hand: readonly Card[],
  cardIds: readonly string[],
  view: {
    openingCardId: string | null;
    lastCombo: Combo | null;
    yourTurn: boolean;
    canInstantChop: boolean;
    phase: 'playing' | 'ended';
  },
): PlayPreview {
  if (view.phase !== 'playing') return { ok: false, text: 'Ván đã kết thúc' };
  if (cardIds.length === 0) {
    return { ok: false, text: view.yourTurn ? 'Chọn bài để đánh' : view.canInstantChop ? 'Bạn có thể chặt ngay' : 'Đang chờ lượt' };
  }
  const picked: Card[] = [];
  for (const id of cardIds) {
    const card = hand.find((item) => item.id === id);
    if (!card) return { ok: false, text: 'Bài không có trong tay' };
    picked.push(card);
  }
  const combo = identify(picked);
  if (!combo) return { ok: false, text: 'Bộ bài không hợp lệ' };
  if (view.openingCardId && !cardIds.includes(view.openingCardId)) {
    return { ok: false, text: `Lượt đầu phải có ${cardLabel(parseCard(view.openingCardId))}` };
  }
  if (view.lastCombo && !canBeat(combo, view.lastCombo)) return { ok: false, text: 'Chưa đủ mạnh để chặt' };
  if (!view.yourTurn) {
    if (view.canInstantChop && combo.kind === 'pairSeq4') return { ok: true, text: '4 đôi thông · Chặt ngay' };
    return { ok: false, text: 'Chưa tới lượt bạn' };
  }
  return { ok: true, text: comboTitle(combo) };
}
