import { useEffect, useMemo, useRef, useState } from 'react';
import { chooseAiMove, instantChopMove } from '../../shared/ai.ts';
import { sortHand, type SortMode } from '../../shared/cards.ts';
import { dealGame, eventText, passTurn, playCards } from '../../shared/game.ts';
import type { GameState, MoveResult } from '../../shared/types.ts';
import type { PublicUser } from '../../shared/protocol.ts';
import { toTableView } from '../../shared/view.ts';
import { playSound } from '../lib/audio.ts';
import { GameTable } from '../components/GameTable.tsx';

interface SoloProps {
  user: PublicUser;
  stake: number;
  instantChop: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
  onExit: () => void;
  onRules: () => void;
  onFinished: (result: { place: number; playerCount: number; delta: number; instant: string | null; stake: number }) => void;
}

function freshGame(user: PublicUser, stake: number, instantChop: boolean, leaderSeat: number | null): GameState {
  return dealGame({
    playerCount: 4,
    names: [user.name, 'Bác Ba', 'Chị Tư', 'Anh Năm'],
    avatars: [user.avatar, null, null, null],
    ids: [user.id, 'bot-ba', 'bot-tu', 'bot-nam'],
    bots: [false, true, true, true],
    stake,
    instantChop,
    leaderSeat,
  });
}

export function SoloGame({ user, stake, instantChop, soundOn, onToggleSound, onExit, onRules, onFinished }: SoloProps) {
  const [state, setState] = useState(() => freshGame(user, stake, instantChop, null));
  const [feed, setFeed] = useState<string[]>(['Ván mới bắt đầu']);
  const [selected, setSelected] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [banner, setBanner] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const reported = useRef(false);
  const leader = useRef<number | null>(null);
  const wasTurn = useRef(false);

  const showBanner = (text: string) => {
    setBanner(text);
    window.setTimeout(() => setBanner((current) => (current === text ? null : current)), 1600);
  };

  const apply = (result: MoveResult) => {
    if (!result.ok) {
      showBanner(result.error);
      playSound('error');
      return;
    }
    const names = result.state.players.map((player) => player.name);
    const lines = result.events
      .map((event) => eventText(event, names, result.state.players.length))
      .filter((line): line is string => !!line);
    setFeed((prev) => [...prev, ...lines].slice(-24));
    for (const event of result.events) {
      if (event.type === 'play' && event.toast) {
        showBanner(event.toast);
        playSound('chop');
      } else if (event.type === 'play') playSound('play');
      else if (event.type === 'pass') playSound('pass');
      else if (event.type === 'finish' && event.place === 1 && event.seat === 0) playSound('win');
    }
    setSelected([]);
    setState(result.state);
  };

  useEffect(() => {
    if (state.phase === 'ended' && state.result?.instant && !reported.current) {
      showBanner('Tới Trắng!');
      playSound('instant');
    }
  }, [state.phase, state.result]);

  useEffect(() => {
    if (state.phase !== 'ended' || reported.current || !state.result) return;
    reported.current = true;
    leader.current = state.finished[0] ?? null;
    const mine = state.result.scores.find((line) => line.seat === 0);
    if (!mine) return;
    onFinished({
      place: mine.place,
      playerCount: state.players.length,
      delta: mine.delta,
      instant: state.result.instant?.type ?? null,
      stake: state.stake,
    });
  }, [state, onFinished]);

  useEffect(() => {
    const mine = state.phase === 'playing' && state.currentTurn === 0;
    if (mine && !wasTurn.current) playSound('turn');
    wasTurn.current = mine;
  }, [state.currentTurn, state.phase, state.turnSerial]);

  useEffect(() => {
    if (state.phase !== 'playing') return;
    const chopSeat = state.players.findIndex((player, index) => player.isBot && instantChopMove(state, index));
    const seat = chopSeat >= 0 ? chopSeat : state.currentTurn;
    if (!state.players[seat]?.isBot) return;
    const delay = chopSeat >= 0 ? 560 : 720 + Math.random() * 380;
    const timer = window.setTimeout(() => {
      const current = stateRef.current;
      if (current.phase !== 'playing') return;
      if (chopSeat >= 0) {
        const ids = instantChopMove(current, chopSeat);
        if (ids) apply(playCards(current, chopSeat, ids));
        return;
      }
      if (current.currentTurn !== seat || !current.players[seat]?.isBot) return;
      const move = chooseAiMove(current, seat);
      apply(move.type === 'pass' ? passTurn(current, seat) : playCards(current, seat, move.cardIds));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state.phase !== 'playing' || state.currentTurn !== 0) return;
    const delay = Math.max(500, state.turnDeadline - Date.now());
    const timer = window.setTimeout(() => {
      const current = stateRef.current;
      if (current.phase !== 'playing' || current.currentTurn !== 0) return;
      showBanner('Hết giờ');
      if (current.lastPlay) apply(passTurn(current, 0));
      else {
        const move = chooseAiMove(current, 0);
        if (move.type === 'play') apply(playCards(current, 0, move.cardIds));
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state.turnSerial, state.phase, state.turnDeadline]);

  useEffect(() => {
    const ids = new Set(state.players[0]?.hand.map((card) => card.id));
    setSelected((prev) => prev.filter((id) => ids.has(id)));
  }, [state]);

  const ordered = useMemo(() => sortHand(state.players[0]?.hand ?? [], sortMode), [state, sortMode]);
  const model = useMemo(() => ({ ...toTableView(state, 0), yourHand: ordered }), [state, ordered]);

  return (
    <GameTable
      model={model}
      feed={feed}
      selected={selected}
      sortMode={sortMode}
      banner={banner}
      soundOn={soundOn}
      againLabel="Chơi ván mới"
      exitLabel="Về sảnh"
      onToggleCard={(id) => setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))}
      onPlay={() => apply(playCards(state, 0, selected))}
      onPass={() => apply(passTurn(state, 0))}
      onSort={() => setSortMode((mode) => (mode === 'rank' ? 'group' : mode === 'group' ? 'suit' : 'rank'))}
      onExit={onExit}
      onAgain={() => {
        reported.current = false;
        setSelected([]);
        const next = freshGame(user, stake, instantChop, leader.current);
        setState(next);
        setFeed([
          next.result?.instant
            ? `Tới trắng! ${next.players[next.result.instant.seat]?.name} — ${next.result.instant.label}`
            : 'Ván mới bắt đầu',
        ]);
        if (next.result?.instant) {
          showBanner('Tới Trắng!');
          playSound('instant');
        }
      }}
      onToggleSound={onToggleSound}
      onRules={onRules}
    />
  );
}
