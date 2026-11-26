import { ArrowLeft, Bot, Copy, Crown, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LobbyRoom, PublicUser, RoomSnapshot } from '../../shared/protocol.ts';
import { sortHand, type SortMode } from '../../shared/cards.ts';
import { playSound } from '../lib/audio.ts';
import { Avatar } from '../components/Avatar.tsx';
import { GameTable } from '../components/GameTable.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { getSocket } from './socket.ts';

interface OnlineProps {
  user: PublicUser;
  stake: number;
  instantChop: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
  onExit: () => void;
  onRules: () => void;
  onRefreshUser: () => void;
}

export function OnlineScreen(props: OnlineProps) {
  const online = useRoom();
  const [sortMode, setSortMode] = useState<SortMode>('rank');
  const [selected, setSelected] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const refreshed = useRef<string | null>(null);

  useEffect(() => {
    if (!online.fx) return;
    setBanner(online.fx.toast);
    playSound(online.fx.toast === 'Tới Trắng!' ? 'instant' : 'chop');
    const timer = window.setTimeout(() => setBanner((current) => (current === online.fx?.toast ? null : current)), 1600);
    return () => window.clearTimeout(timer);
  }, [online.fx]);

  useEffect(() => {
    const table = online.room?.table;
    if (!table || table.phase !== 'ended') {
      refreshed.current = null;
      return;
    }
    const key = `${online.room?.code}:${table.turnSerial}:end`;
    if (refreshed.current === key) return;
    refreshed.current = key;
    props.onRefreshUser();
    const mine = table.result?.scores.find((line) => line.seat === table.you);
    if (mine?.place === 1) playSound('win');
  }, [online.room, props]);

  useEffect(() => {
    const ids = new Set(online.room?.table?.yourHand.map((card) => card.id));
    setSelected((prev) => prev.filter((id) => ids.has(id)));
  }, [online.room?.table?.yourHand]);

  const wasTurn = useRef(false);
  useEffect(() => {
    const mine = !!online.room?.table?.yourTurn;
    if (mine && !wasTurn.current) playSound('turn');
    wasTurn.current = mine;
  }, [online.room?.table?.turnSerial, online.room?.table?.yourTurn]);

  if (!online.room) {
    return (
      <LobbyView
        rooms={online.rooms}
        status={online.status}
        error={online.error}
        stake={props.stake}
        instantChop={props.instantChop}
        onExit={props.onExit}
        onCreate={() => online.emit('room:create', { stake: props.stake, instantChop: props.instantChop })}
        onJoin={(code) => online.emit('room:join', { code })}
      />
    );
  }

  if (online.room.phase === 'lobby' || !online.room.table) {
    return (
      <WaitingRoom
        room={online.room}
        user={props.user}
        error={online.error}
        onLeave={() => {
          online.emit('room:leave');
        }}
        onReady={() => online.emit('room:ready')}
        onAddBot={() => online.emit('room:addBot')}
        onRemoveBot={(index) => online.emit('room:removeBot', { index })}
        onStart={() => online.emit('room:start')}
        onSettings={(patch) => online.emit('room:settings', patch)}
      />
    );
  }

  const table = online.room.table;
  const ordered = sortHand(table.yourHand, sortMode);
  const model = { ...table, yourHand: ordered };
  return (
    <>
      {online.error && <p className="fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-[#3a2a08] px-4 py-2 text-sm text-gold">{online.error}</p>}
      <GameTable
        model={model}
        feed={online.room.feed}
        selected={selected}
        sortMode={sortMode}
        banner={banner}
        soundOn={props.soundOn}
        againLabel="Chơi ván mới"
        exitLabel="Rời phòng"
        onToggleCard={(id) => setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))}
        onPlay={() => {
          playSound('play');
          online.emit('game:play', { cardIds: selected });
          setSelected([]);
        }}
        onPass={() => {
          playSound('pass');
          online.emit('game:pass');
        }}
        onSort={() => setSortMode((mode) => (mode === 'rank' ? 'group' : mode === 'group' ? 'suit' : 'rank'))}
        onExit={() => online.emit('room:leave')}
        onAgain={() => online.emit('game:again')}
        onToggleSound={props.onToggleSound}
        onRules={props.onRules}
      />
    </>
  );
}

function useRoom() {
  const [status, setStatus] = useState<'connecting' | 'online' | 'error'>('connecting');
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fx, setFx] = useState<{ id: number; toast: string } | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setStatus('online');
    const onDisconnect = () => setStatus('connecting');
    const onConnectError = (err: Error) => {
      setStatus('error');
      setError(err.message || 'Không vào được sảnh');
    };
    const onRooms = (list: LobbyRoom[]) => setRooms(list);
    const onRoom = (snap: RoomSnapshot | null) => {
      setRoom(snap);
      setError(null);
    };
    const onAppError = (payload: { message?: string }) => setError(payload.message || 'Có lỗi');
    const onFx = (payload: { toast?: string }) => {
      if (payload.toast) setFx({ id: Date.now(), toast: payload.toast });
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('lobby:rooms', onRooms);
    socket.on('room:state', onRoom);
    socket.on('app:error', onAppError);
    socket.on('game:fx', onFx);
    if (socket.connected) setStatus('online');
    socket.emit('lobby:subscribe');
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('lobby:rooms', onRooms);
      socket.off('room:state', onRoom);
      socket.off('app:error', onAppError);
      socket.off('game:fx', onFx);
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 2800);
    return () => window.clearTimeout(timer);
  }, [error]);

  const emit = (event: string, payload?: unknown) => {
    getSocket().emit(event, payload);
  };

  return { status, rooms, room, error, fx, emit };
}

function LobbyView({
  rooms,
  status,
  error,
  onExit,
  onCreate,
  onJoin,
}: {
  rooms: LobbyRoom[];
  status: 'connecting' | 'online' | 'error';
  error: string | null;
  stake: number;
  instantChop: boolean;
  onExit: () => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  return (
    <div className="felt min-h-dvh" data-screen="lobby">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-4">
        <header className="mb-4 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onExit} aria-label="Về trang chủ">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-extrabold text-gold">Sảnh online</h1>
            <p className="text-xs text-white/70">
              {status === 'online' ? 'Đã kết nối' : status === 'error' ? 'Mất kết nối' : 'Đang vào sảnh...'}
            </p>
          </div>
        </header>
        {error && <p className="mb-3 rounded-xl bg-black/30 px-3 py-2 text-sm text-gold">{error}</p>}
        <div className="grid grid-cols-1 gap-2">
          <Button className="h-12" onClick={onCreate} data-testid="create-room">
            Tạo phòng
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (code.trim()) onJoin(code.trim().toUpperCase());
            }}
          >
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="Mã phòng 6 ký tự"
              maxLength={6}
              aria-label="Mã phòng"
              data-testid="join-code"
              className="uppercase tracking-[0.2em]"
            />
            <Button type="submit" variant="secondary">
              Vào phòng
            </Button>
          </form>
        </div>
        <h2 className="mb-2 mt-5 text-sm font-bold text-gold">Phòng đang mở</h2>
        {rooms.length === 0 ? (
          <p className="rounded-2xl bg-black/20 px-3 py-4 text-sm text-white/75">Chưa có phòng. Hãy tạo phòng để mời bạn.</p>
        ) : (
          <ul className="space-y-2">
            {rooms.map((room) => (
              <li key={room.code}>
                <button
                  type="button"
                  disabled={room.status !== 'waiting'}
                  onClick={() => onJoin(room.code)}
                  className="flex w-full items-center justify-between rounded-2xl bg-black/25 px-3 py-3 text-left disabled:opacity-60"
                >
                  <span>
                    <span className="block font-bold tracking-[0.18em]">{room.code}</span>
                    <span className="text-xs text-white/65">
                      {room.hostName} · {room.players} người · {room.bots} máy · cược {room.stake}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-gold">{room.status === 'waiting' ? 'Vào' : 'Đang chơi'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function WaitingRoom({
  room,
  user,
  error,
  onLeave,
  onReady,
  onAddBot,
  onRemoveBot,
  onStart,
  onSettings,
}: {
  room: RoomSnapshot;
  user: PublicUser;
  error: string | null;
  onLeave: () => void;
  onReady: () => void;
  onAddBot: () => void;
  onRemoveBot: (index: number) => void;
  onStart: () => void;
  onSettings: (patch: { stake?: number; instantChop?: boolean }) => void;
}) {
  const [copied, setCopied] = useState(false);
  const host = room.hostId === user.id;
  const me = room.seats[room.you];
  const humanCount = room.seats.filter((seat) => !seat.isBot && !seat.left).length;
  const ready = room.seats.filter((seat) => !seat.isBot && !seat.left).every((seat) => seat.ready);
  const slots = useMemo(() => {
    const filled = room.seats.map((seat) => ({ kind: 'player' as const, seat }));
    const empty = Array.from({ length: Math.max(0, 4 - room.seats.length) }, (_, index) => ({ kind: 'empty' as const, index }));
    return [...filled, ...empty];
  }, [room.seats]);

  return (
    <div className="felt min-h-dvh" data-screen="room">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-4">
        <header className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onLeave} aria-label="Rời phòng">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="text-xs text-white/70">Mã phòng</div>
            <div className="text-2xl font-black tracking-[0.28em] text-gold" data-testid="room-code">
              {room.code}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(room.code).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              });
            }}
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Đã chép' : 'Chép'}
          </Button>
        </header>
        {error && <p className="mb-3 rounded-xl bg-black/30 px-3 py-2 text-sm text-gold">{error}</p>}
        <p className="mb-3 text-sm text-white/75">
          <Users className="mr-1 inline h-4 w-4" />
          {humanCount} người trong phòng. Cần 2–4 ghế để bắt đầu.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {slots.map((slot) =>
            slot.kind === 'empty' ? (
              <button
                key={`empty-${slot.index}`}
                type="button"
                disabled={!host}
                onClick={onAddBot}
                data-testid="add-bot"
                className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-white/25 text-sm text-white/70 disabled:opacity-50"
              >
                <Bot className="mb-1 h-5 w-5" />
                {host ? 'Thêm máy' : 'Ghế trống'}
              </button>
            ) : (
              <div key={slot.seat.index} className="rounded-2xl bg-black/25 p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={slot.seat.name} url={slot.seat.avatar} size={40} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 truncate text-sm font-bold">
                      {slot.seat.isHost && <Crown className="h-3.5 w-3.5 text-gold" />}
                      {slot.seat.name}
                    </div>
                    <div className="text-[11px] text-white/60">
                      {slot.seat.left ? 'Đã rời' : slot.seat.isBot ? 'Máy' : slot.seat.ready ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
                      {!slot.seat.connected && !slot.seat.isBot ? ' · Mất kết nối' : ''}
                    </div>
                  </div>
                </div>
                {host && slot.seat.isBot && (
                  <button type="button" className="mt-2 text-xs text-rose-200" onClick={() => onRemoveBot(slot.seat.index)}>
                    Mời ra
                  </button>
                )}
              </div>
            ),
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold text-white/70">Cược</div>
          <div className="grid grid-cols-4 gap-2">
            {[10, 20, 50, 100].map((value) => (
              <Button
                key={value}
                size="sm"
                variant={room.stake === value ? 'default' : 'secondary'}
                disabled={!host}
                onClick={() => onSettings({ stake: value })}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={!host}
          onClick={() => onSettings({ instantChop: !room.instantChop })}
          className="mt-3 flex items-center justify-between rounded-2xl bg-black/20 px-3 py-3 text-left disabled:opacity-70"
        >
          <span className="text-sm font-semibold">4 đôi thông chặt không cần vòng</span>
          <span className="text-xs font-bold text-gold">{room.instantChop ? 'Bật' : 'Tắt'}</span>
        </button>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          <Button variant="secondary" onClick={onReady} data-testid="ready-button">
            {me?.ready ? 'Hủy sẵn sàng' : 'Sẵn sàng'}
          </Button>
          <Button onClick={onStart} disabled={!host || room.seats.length < 2 || !ready} data-testid="start-game">
            Bắt đầu
          </Button>
        </div>
      </div>
    </div>
  );
}
