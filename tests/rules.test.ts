import { describe, expect, it } from 'vitest';
import { chooseAiMove, instantChopMove } from '../src/shared/ai.ts';
import { createDeck, mulberry32, parseCards, sortCards } from '../src/shared/cards.ts';
import { canBeat, chops, comboKey, identify, listCombos } from '../src/shared/combo.ts';
import { dealGame, passTurn, playCards } from '../src/shared/game.ts';
import { detectInstant } from '../src/shared/instant.ts';
import { scoreMatch } from '../src/shared/scoring.ts';
import type { Combo, GameState, MoveResult } from '../src/shared/types.ts';

function combo(spec: string): Combo {
  const found = identify(parseCards(spec));
  if (!found) throw new Error(`Không phải bộ hợp lệ: ${spec}`);
  return found;
}

function must(result: MoveResult): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe('bộ bài và thứ tự', () => {
  it('bộ 52 lá, 3♠ nhỏ nhất và 2♥ lớn nhất', () => {
    const deck = createDeck();
    expect(new Set(deck.map((card) => card.id)).size).toBe(52);
    const sorted = sortCards(deck);
    expect(sorted[0]!.id).toBe('3S');
    expect(sorted[sorted.length - 1]!.id).toBe('2H');
    expect(sorted.map((card) => card.id).slice(0, 4)).toEqual(['3S', '3C', '3D', '3H']);
  });

  it('nhận dạng lẻ, đôi, sám, sảnh, tứ quý và đôi thông', () => {
    expect(combo('10S').kind).toBe('single');
    expect(combo('7S 7H').kind).toBe('pair');
    expect(combo('7S 7C 7D').kind).toBe('triple');
    expect(combo('7S 7C 7D 7H').kind).toBe('fourKind');
    expect(combo('3S 4D 5H').kind).toBe('straight');
    expect(combo('10S JH QD').length).toBe(3);
    expect(combo('JS QH KD AS').rank).toBe(14);
    expect(combo('3S 4S 5S 6S 7S').length).toBe(5);
    expect(combo('3S 3C 4S 4C 5S 5C').kind).toBe('pairSeq3');
    expect(combo('3S 3C 4S 4C 5S 5C 6S 6C').kind).toBe('pairSeq4');
    expect(combo('9S 9C 10S 10C JS JC').rank).toBe(11);
  });

  it('từ chối bộ không hợp lệ', () => {
    const invalid = [
      '7S 8C',
      '7S 7C 8S',
      '7S 7C 7D 8H',
      '3S 4S 4D 5S',
      'AS 2S 3S',
      'KS AS 2H',
      '3S 4S 6S',
      '2S 2C 3S 3C 4S 4C',
      'KS KC AS AC 2S 2C',
      '7S 7C 8S 8C',
      '3S 3C 4S 4C 5S 5C 6S 6C 7S 7C',
      '3S 3S',
    ];
    for (const spec of invalid) expect(identify(parseCards(spec)), spec).toBeNull();
  });
});

describe('so bài và chặt', () => {
  it('so cùng loại theo nước rồi chất', () => {
    expect(canBeat(combo('2S'), combo('AS'))).toBe(true);
    expect(canBeat(combo('2S'), combo('2C'))).toBe(false);
    expect(canBeat(combo('2H'), combo('2S'))).toBe(true);
    expect(canBeat(combo('2H'), combo('2D'))).toBe(true);
    expect(canBeat(combo('2D'), combo('2C'))).toBe(true);
    expect(canBeat(combo('KH KD'), combo('KS KC'))).toBe(true);
    expect(canBeat(combo('7S 7C 7D'), combo('6S 6C 6D'))).toBe(true);
    expect(canBeat(combo('5H 4S 3S'), combo('5D 4H 3H'))).toBe(true);
    expect(canBeat(combo('6S 5S 4S'), combo('5H 4S 3S'))).toBe(true);
    expect(canBeat(combo('9S 8S 7S 6S'), combo('5H 4H 3H'))).toBe(false);
    expect(canBeat(combo('5H 4H 3H'), combo('9S 8S 7S 6S'))).toBe(false);
    expect(canBeat(combo('5S 5C 6S 6C 7S 7H'), combo('3S 3C 4S 4C 5S 5D'))).toBe(true);
    expect(canBeat(combo('8S 8C'), combo('8D 8H'))).toBe(false);
  });

  it('3 đôi thông chặt 2 lẻ và 3 đôi thông nhỏ hơn', () => {
    const small = combo('3S 3C 4S 4C 5S 5C');
    const big = combo('4S 4C 5S 5C 6S 6C');
    expect(chops(small, combo('2H'))).toBe(true);
    expect(canBeat(small, combo('2S'))).toBe(true);
    expect(canBeat(small, combo('KS'))).toBe(false);
    expect(canBeat(small, combo('2S 2H'))).toBe(false);
    expect(canBeat(big, small)).toBe(true);
    expect(canBeat(small, big)).toBe(false);
    expect(canBeat(small, combo('7S 7C 7D 7H'))).toBe(false);
  });

  it('tứ quý chặt 2 lẻ, đôi 2, 3 đôi thông và tứ quý nhỏ hơn', () => {
    const four = combo('3S 3C 3D 3H');
    const fourBig = combo('4S 4C 4D 4H');
    const seq = combo('5S 5C 6S 6C 7S 7C');
    expect(canBeat(four, combo('2H'))).toBe(true);
    expect(canBeat(four, combo('2S 2H'))).toBe(true);
    expect(canBeat(four, seq)).toBe(true);
    expect(canBeat(fourBig, four)).toBe(true);
    expect(canBeat(four, fourBig)).toBe(false);
    expect(canBeat(four, combo('KS'))).toBe(false);
    expect(canBeat(four, combo('KS KC'))).toBe(false);
    expect(canBeat(combo('2S 2C 2D 2H'), fourBig)).toBe(true);
  });

  it('4 đôi thông chặt 2, đôi 2, 3 đôi thông, tứ quý và 4 đôi thông nhỏ hơn', () => {
    const seq = combo('3S 3C 4S 4C 5S 5C 6S 6C');
    const bigger = combo('4S 4C 5S 5C 6S 6C 7S 7C');
    expect(canBeat(seq, combo('2H'))).toBe(true);
    expect(canBeat(seq, combo('2S 2H'))).toBe(true);
    expect(canBeat(seq, combo('9S 9C 10S 10C JS JC'))).toBe(true);
    expect(canBeat(seq, combo('2S 2C 2D 2H'))).toBe(true);
    expect(canBeat(seq, combo('KS KC KD KH'))).toBe(true);
    expect(canBeat(bigger, seq)).toBe(true);
    expect(canBeat(seq, bigger)).toBe(false);
    expect(canBeat(combo('KS KC KD KH'), seq)).toBe(false);
    expect(comboKey(bigger)).toBeGreaterThan(comboKey(seq));
  });
});

describe('tới trắng', () => {
  it('nhận sảnh rồng, tứ quý 2, 6 đôi, 5 đôi thông và 4 sám', () => {
    const dragon = parseCards('3S 4S 5S 6S 7S 8S 9S 10S JS QS KS AS 2H');
    expect(detectInstant(dragon)).toBe('dragon');

    const fourTwos = parseCards('2S 2C 2D 2H 3S 4S 5S 6S 7S 8S 9S 10S JS');
    expect(detectInstant(fourTwos)).toBe('fourTwos');

    const sixAndTwos = parseCards('2S 2C 2D 2H 3S 3C 4S 4C 5S 5C 6S 6C 9S');
    expect(detectInstant(sixAndTwos)).toBe('fourTwos');

    const sixPairs = parseCards('3S 3C 4S 4C 5S 5C 6S 6C 7S 7C 8S 8C 9S');
    expect(detectInstant(sixPairs)).toBe('sixPairs');

    const fiveSeq = parseCards('3S 3C 4S 4C 5S 5C 6S 6C 7S 7C 9S 10S JS');
    expect(detectInstant(fiveSeq)).toBe('fivePairSeq');

    const fourTriples = parseCards('3S 3C 3D 4S 4C 4D 5S 5C 5D 6S 6C 6D 9S');
    expect(detectInstant(fourTriples)).toBe('fourTriples');

    expect(detectInstant(parseCards('3S 4C 5D 6H 7S 8C 9D 10H JS QC KD 2C'))).toBeNull();
  });

  it('kết thúc ván ngay khi có sảnh rồng', () => {
    const state = dealGame({
      hands: [
        parseCards('3S 4S 5S 6S 7S 8S 9S 10S JS QS KS AS 2H'),
        parseCards('3C'),
        parseCards('4C'),
        parseCards('5C'),
      ],
      stake: 20,
    });
    expect(state.phase).toBe('ended');
    expect(state.result?.instant?.type).toBe('dragon');
    expect(state.result?.instant?.label).toBe('Sảnh rồng');
    expect(state.result?.scores.find((line) => line.seat === 0)?.delta).toBe(300);
    expect(playCards(state, 0, ['3S']).ok).toBe(false);
  });
});

describe('lượt, bỏ lượt và vòng mới', () => {
  it('lượt đầu phải có 3♠, các lượt sau thì không', () => {
    let state = dealGame({
      hands: [
        parseCards('3S 3C 4S 9S'),
        parseCards('5S 6S 7S 8S'),
        parseCards('10S JS QS KS'),
        parseCards('AS AD 4C 4D'),
      ],
      stake: 10,
      instantChop: false,
    });
    expect(state.currentTurn).toBe(0);
    expect(state.openingCardId).toBe('3S');
    expect(playCards(state, 0, ['4S']).ok).toBe(false);
    expect(playCards(state, 0, ['9S']).ok).toBe(false);
    expect(playCards(state, 1, ['5S']).ok).toBe(false);

    const paired = playCards(state, 0, ['3S', '3C']);
    expect(paired.ok).toBe(true);
    if (paired.ok) expect(paired.state.openingCardId).toBeNull();

    state = dealGame({
      hands: [
        parseCards('3S 9C'),
        parseCards('5S 6S'),
        parseCards('10S JS'),
        parseCards('AS KD'),
      ],
      leaderSeat: 1,
    });
    expect(state.currentTurn).toBe(1);
    expect(state.openingCardId).toBeNull();
    expect(playCards(state, 1, ['5S']).ok).toBe(true);
  });

  it('bỏ lượt rồi không được đánh cho đến vòng mới', () => {
    let state = dealGame({
      hands: [
        parseCards('3S 4S 5S'),
        parseCards('3C 6S 7S'),
        parseCards('3D 8S 9S'),
        parseCards('3H 10S JS'),
      ],
      opening: 'none',
      instantChop: false,
    });
    const before = state.players[0]!.hand.length;
    state = must(playCards(state, 0, ['3S']));
    expect(state.players[0]!.hand).toHaveLength(2);
    expect(dealGame({
      hands: [
        parseCards('3S 4S 5S'),
        parseCards('3C 6S 7S'),
        parseCards('3D 8S 9S'),
        parseCards('3H 10S JS'),
      ],
      opening: 'none',
    }).players[0]!.hand).toHaveLength(before);

    expect(playCards(state, 1, ['6S']).ok).toBe(true);
    state = must(passTurn(state, 1));
    expect(playCards(state, 1, ['7S']).ok).toBe(false);
    state = must(passTurn(state, 2));
    state = must(passTurn(state, 3));
    expect(passTurn(state, 0).ok).toBe(false);
    expect(state.lastPlay).toBeNull();
    expect(state.currentTurn).toBe(0);
    expect(state.passed.every((passed) => !passed)).toBe(true);
    state = must(playCards(state, 0, ['4S']));
    expect(playCards(state, 1, ['6S']).ok).toBe(true);
  });

  it('người đánh cuối thắng vòng, người đã về thì người kế đi tiếp', () => {
    let state = dealGame({
      hands: [
        parseCards('3S'),
        parseCards('4S 8S 9C'),
        parseCards('5S 10C'),
        parseCards('6S JC'),
      ],
      opening: 'none',
      instantChop: false,
      stake: 10,
    });
    state = must(playCards(state, 0, ['3S']));
    expect(state.finished).toEqual([0]);
    expect(state.phase).toBe('playing');
    state = must(passTurn(state, 1));
    state = must(passTurn(state, 2));
    state = must(passTurn(state, 3));
    expect(state.currentTurn).toBe(1);
    expect(state.lastPlay).toBeNull();
    state = must(playCards(state, 1, ['4S']));
    state = must(playCards(state, 2, ['5S']));
    state = must(playCards(state, 3, ['6S']));
    state = must(passTurn(state, 1));
    expect(state.currentTurn).toBe(2);
    state = must(passTurn(state, 2));
    expect(state.lastPlay).toBeNull();
    expect(state.currentTurn).toBe(3);
    expect(passTurn(state, 3).ok).toBe(false);
  });

  it('hết bài thì xếp hạng và cộng điểm, có thối heo', () => {
    let state = dealGame({
      hands: [parseCards('3S'), parseCards('2S 4S')],
      opening: 'none',
      stake: 10,
      instantChop: false,
    });
    state = must(playCards(state, 0, ['3S']));
    expect(state.phase).toBe('ended');
    expect(state.finished).toEqual([0, 1]);
    const winner = state.result?.scores.find((line) => line.seat === 0);
    const loser = state.result?.scores.find((line) => line.seat === 1);
    expect(winner?.label).toBe('Nhất');
    expect(loser?.label).toBe('Bét');
    expect(winner?.delta).toBe(30);
    expect(loser?.delta).toBe(-30);
    expect(loser?.notes.some((note) => note.includes('heo'))).toBe(true);
    expect((winner?.delta ?? 0) + (loser?.delta ?? 0)).toBe(0);
  });

  it('4 đôi thông chặt không cần vòng khi bật, và bị khóa sau khi bỏ lượt', () => {
    const bomb = ['3S', '3C', '4S', '4C', '5S', '5C', '6S', '6C'];
    let state = dealGame({
      hands: [parseCards('2S 9S'), parseCards('3D 8D'), parseCards(bomb.join(' ')), parseCards('7D KD')],
      opening: 'none',
      instantChop: true,
    });
    state = must(playCards(state, 0, ['2S']));
    expect(state.currentTurn).toBe(1);
    expect(instantChopMove(state, 2)).toEqual(bomb);
    const chopped = playCards(state, 2, bomb);
    expect(chopped.ok).toBe(true);
    if (chopped.ok) {
      expect(chopped.state.lastPlay?.seat).toBe(2);
      expect(chopped.events[0]).toMatchObject({ type: 'play', toast: 'Chặt Heo!' });
      expect(chopped.state.currentTurn).not.toBe(2);
    }
    expect(playCards(state, 2, ['3S']).ok).toBe(false);

    let locked = dealGame({
      hands: [parseCards('2S 9S'), parseCards('3D'), parseCards(bomb.join(' ')), parseCards('7D')],
      opening: 'none',
      instantChop: true,
    });
    locked = must(playCards(locked, 0, ['2S']));
    locked = must(passTurn(locked, 1));
    locked = must(passTurn(locked, 2));
    expect(playCards(locked, 2, bomb).ok).toBe(false);

    const off = dealGame({
      hands: [parseCards('2S 9S'), parseCards('3D 8D'), parseCards(bomb.join(' ')), parseCards('7D KD')],
      opening: 'none',
      instantChop: false,
    });
    const led = must(playCards(off, 0, ['2S']));
    expect(playCards(led, 2, bomb).ok).toBe(false);
  });
});

describe('tính điểm', () => {
  it('hạng 4 người và thối cộng lại vẫn cân bằng', () => {
    const result = scoreMatch({
      finished: [0, 1, 2, 3],
      hands: [[], [], [], parseCards('2S 2H 7S 7C 7D 7H')],
      stake: 10,
      instant: null,
    });
    const deltas = result.scores.map((line) => line.delta);
    expect(result.scores.map((line) => line.label)).toEqual(['Nhất', 'Nhì', 'Ba', 'Bét']);
    expect(deltas.reduce((sum, delta) => sum + delta, 0)).toBe(0);
    expect(result.scores[0]!.delta).toBe(70);
    expect(result.scores[3]!.delta).toBe(-70);
  });

  it('3 người và tới trắng', () => {
    const normal = scoreMatch({
      finished: [2, 0, 1],
      hands: [[], [], []],
      stake: 20,
      instant: null,
    });
    expect(normal.scores.find((line) => line.seat === 2)?.label).toBe('Nhất');
    expect(normal.scores.find((line) => line.seat === 0)?.label).toBe('Nhì');
    expect(normal.scores.find((line) => line.seat === 1)?.label).toBe('Bét');
    expect(normal.scores.reduce((sum, line) => sum + line.delta, 0)).toBe(0);

    const instant = scoreMatch({
      finished: [1, 0, 2],
      hands: [parseCards('3S'), parseCards('4S'), parseCards('5S')],
      stake: 20,
      instant: { type: 'fourTriples', seat: 1 },
    });
    expect(instant.instant?.label).toBe('4 sám cô');
    expect(instant.scores.find((line) => line.seat === 1)?.delta).toBe(200);
    expect(instant.scores.reduce((sum, line) => sum + line.delta, 0)).toBe(0);
  });
});

describe('máy đánh hết ván', () => {
  it('tự chơi hết nhiều ván 2, 3 và 4 người', () => {
    const setups = [
      { playerCount: 4, instantChop: true, games: 12 },
      { playerCount: 3, instantChop: true, games: 6 },
      { playerCount: 2, instantChop: false, games: 6 },
    ];
    for (const setup of setups) {
      for (let seed = 1; seed <= setup.games; seed++) {
        let state = dealGame({
          playerCount: setup.playerCount,
          rng: mulberry32(setup.playerCount * 1000 + seed),
          instantChop: setup.instantChop,
          stake: 20,
          bots: Array.from({ length: setup.playerCount }, () => true),
        });
        let guard = 0;
        while (state.phase === 'playing' && guard++ < 800) {
          const chopSeat = state.players.findIndex((_, seat) => instantChopMove(state, seat));
          const actor = chopSeat >= 0 ? chopSeat : state.currentTurn;
          const move =
            chopSeat >= 0
              ? { type: 'play' as const, cardIds: instantChopMove(state, chopSeat)! }
              : chooseAiMove(state, actor);
          const result =
            move.type === 'pass' ? passTurn(state, actor) : playCards(state, actor, move.cardIds);
          if (!result.ok) throw new Error(`${setup.playerCount}p seed ${seed}: ${result.error}`);
          state = result.state;
        }
        expect(state.phase, `${setup.playerCount}p seed ${seed}`).toBe('ended');
        expect(state.finished).toHaveLength(setup.playerCount);
        expect(new Set(state.finished).size).toBe(setup.playerCount);
        const total = state.result?.scores.reduce((sum, line) => sum + line.delta, 0) ?? 1;
        expect(total).toBe(0);
        expect(state.result?.scores.filter((line) => line.place === 1)).toHaveLength(1);
      }
    }
  });

  it('liệt kê bộ trong tay có chứa lá đã cho', () => {
    const hand = parseCards('3S 3C 3D 4S 5H 7S 7C 9D 10S JS QS KS AS');
    const all = listCombos(hand);
    expect(all.some((item) => item.kind === 'triple')).toBe(true);
    expect(all.some((item) => item.kind === 'straight' && item.length >= 5)).toBe(true);
    expect(all.every((item) => identify(item.cards)?.kind === item.kind)).toBe(true);
  });
});
