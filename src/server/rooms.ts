import type { Server, Socket } from 'socket.io';
import { chooseAiMove, instantChopMove } from '../shared/ai.ts';
import { dealGame, eventText, passTurn, playCards } from '../shared/game.ts';
import type { GameResult, GameState, MoveResult } from '../shared/types.ts';
import type { LobbyRoom, PublicUser, RoomSnapshot, SeatInfo } from '../shared/protocol.ts';
import { toTableView } from '../shared/view.ts';
import type { AppDb } from './db.ts';

interface Seat {
  userId: string;
  name: string;
  avatar: string | null;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  left: boolean;
  socketId: string | null;
  grace?: ReturnType<typeof setTimeout>;
}

interface Room {
  code: string;
  hostId: string;
  stake: number;
  instantChop: boolean;
  seats: Seat[];
  phase: 'lobby' | 'table';
  game: GameState | null;
  feed: string[];
  nextLeaderUserId: string | null;
  scored: boolean;
  token: number;
  timer?: ReturnType<typeof setTimeout>;
  chopTimer?: ReturnType<typeof setTimeout>;
}

const STAKES = [10, 20, 50, 100];
const BOT_NAMES = ['Bác Ba', 'Chị Tư', 'Anh Năm', 'Cô Bảy'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function attachSockets(io: Server, db: AppDb, readUser: (cookie: string | undefined) => PublicUser | null): void {
  const rooms = new Map<string, Room>();
  const userRoom = new Map<string, string>();

  function codeOf(): string {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return rooms.has(code) ? codeOf() : code;
  }

  function roomOfUser(userId: string): Room | undefined {
    const code = userRoom.get(userId);
    return code ? rooms.get(code) : undefined;
  }

  function listRooms(): LobbyRoom[] {
    return [...rooms.values()]
      .map((room): LobbyRoom => ({
        code: room.code,
        hostName: room.seats.find((seat) => seat.userId === room.hostId)?.name ?? 'Phòng',
        players: room.seats.filter((seat) => !seat.isBot && !seat.left).length,
        bots: room.seats.filter((seat) => seat.isBot).length,
        status: room.phase === 'lobby' ? 'waiting' : 'playing',
        stake: room.stake,
      }))
      .sort((a, b) => (a.status === b.status ? a.code.localeCompare(b.code) : a.status === 'waiting' ? -1 : 1));
  }

  function broadcastLobby(): void {
    io.to('lobby').emit('lobby:rooms', listRooms());
  }

  function snapshot(room: Room, userId: string): RoomSnapshot {
    const you = room.seats.findIndex((seat) => seat.userId === userId && !seat.left);
    const seats: SeatInfo[] = room.seats.map((seat, index) => ({
      index,
      name: seat.name,
      avatar: seat.avatar,
      isBot: seat.isBot,
      ready: seat.ready,
      connected: seat.connected && !seat.left,
      isHost: seat.userId === room.hostId,
      left: seat.left,
    }));
    let table = room.game && you >= 0 ? toTableView(room.game, you) : null;
    if (table) {
      table = {
        ...table,
        seats: table.seats.map((seat, index) => ({
          ...seat,
          name: room.seats[index]?.name ?? seat.name,
          avatar: room.seats[index]?.avatar ?? seat.avatar,
          isBot: room.seats[index]?.isBot || room.seats[index]?.left || seat.isBot,
          connected: !!room.seats[index]?.connected && !room.seats[index]?.left,
        })),
      };
    }
    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      you,
      stake: room.stake,
      instantChop: room.instantChop,
      seats,
      table,
      feed: room.feed.slice(-20),
    };
  }

  function sendRoom(room: Room): void {
    for (const seat of room.seats) {
      if (!seat.socketId || seat.left) continue;
      io.sockets.sockets.get(seat.socketId)?.emit('room:state', snapshot(room, seat.userId));
    }
    broadcastLobby();
  }

  function clearTimers(room: Room): void {
    if (room.timer) clearTimeout(room.timer);
    if (room.chopTimer) clearTimeout(room.chopTimer);
    room.timer = undefined;
    room.chopTimer = undefined;
  }

  function destroy(room: Room): void {
    clearTimers(room);
    for (const seat of room.seats) {
      if (seat.grace) clearTimeout(seat.grace);
      if (!seat.isBot) userRoom.delete(seat.userId);
      const sock = seat.socketId ? io.sockets.sockets.get(seat.socketId) : undefined;
      sock?.leave(room.code);
      sock?.emit('room:state', null);
    }
    rooms.delete(room.code);
    broadcastLobby();
  }

  function record(room: Room, result: GameResult): void {
    for (const line of result.scores) {
      const seat = room.seats[line.seat];
      if (!seat || seat.isBot || seat.left || seat.userId.startsWith('bot:')) continue;
      try {
        db.recordMatch(seat.userId, {
          place: line.place,
          playerCount: room.seats.length,
          delta: line.delta,
          instant: result.instant?.type ?? null,
          mode: 'online',
        });
      } catch (error) {
        console.error('Không lưu được điểm', error);
      }
    }
  }

  function finishIfNeeded(room: Room, state: GameState): void {
    if (state.phase !== 'ended' || !state.result || room.scored) return;
    room.scored = true;
    const winner = state.finished[0];
    if (winner != null) room.nextLeaderUserId = room.seats[winner]?.userId ?? null;
    record(room, state.result);
  }

  function commit(room: Room, result: MoveResult): boolean {
    if (!result.ok || !room.game) return false;
    clearTimers(room);
    room.token += 1;
    room.game = result.state;
    const names = room.seats.map((seat) => seat.name);
    for (const event of result.events) {
      const line = eventText(event, names, room.seats.length);
      if (line) room.feed.push(line);
      if (event.type === 'play' && event.toast) io.to(room.code).emit('game:fx', { toast: event.toast });
    }
    if (room.feed.length > 40) room.feed.splice(0, room.feed.length - 40);
    finishIfNeeded(room, result.state);
    sendRoom(room);
    arm(room);
    return true;
  }

  function arm(room: Room): void {
    clearTimers(room);
    const game = room.game;
    if (!game || game.phase !== 'playing' || room.phase !== 'table') return;
    const token = ++room.token;
    const seatIndex = game.currentTurn;
    const actor = room.seats[seatIndex];
    if (!actor) return;

    const chopSeat = room.seats.findIndex(
      (seat, index) => (seat.isBot || seat.left) && instantChopMove(game, index),
    );
    if (chopSeat >= 0) {
      room.chopTimer = setTimeout(() => {
        if (room.token !== token || !room.game) return;
        const ids = instantChopMove(room.game, chopSeat);
        if (!ids) return;
        commit(room, playCards(room.game, chopSeat, ids));
      }, 420);
    }

    let budget = 30_000;
    if (actor.isBot || actor.left) {
      const preview = chooseAiMove(game, seatIndex);
      budget = (preview.type === 'pass' ? 860 : 1100) + Math.floor(Math.random() * 280);
    } else if (!actor.connected) {
      budget = 12_000;
    }
    room.game = { ...game, turnDeadline: Date.now() + budget, turnBudgetMs: budget, turnSerial: game.turnSerial };
    room.timer = setTimeout(() => {
      if (room.token !== token || !room.game || room.game.phase !== 'playing') return;
      if (room.game.currentTurn !== seatIndex) return;
      const live = room.seats[seatIndex];
      if (!live) return;
      const current = room.game;
      const automatic = live.isBot || live.left || !live.connected;
      if (!automatic && current.lastPlay) {
        commit(room, passTurn(current, seatIndex));
        return;
      }
      const move = chooseAiMove(current, seatIndex);
      if (move.type === 'pass') commit(room, passTurn(current, seatIndex));
      else commit(room, playCards(current, seatIndex, move.cardIds));
    }, budget);
    sendRoom(room);
  }

  function startGame(room: Room): void {
    const leader = room.seats.findIndex((seat) => seat.userId === room.nextLeaderUserId);
    const game = dealGame({
      playerCount: room.seats.length,
      names: room.seats.map((seat) => seat.name),
      avatars: room.seats.map((seat) => seat.avatar),
      bots: room.seats.map((seat) => seat.isBot || seat.left),
      ids: room.seats.map((seat) => seat.userId),
      stake: room.stake,
      instantChop: room.instantChop,
      leaderSeat: leader >= 0 ? leader : null,
      connected: room.seats.map((seat) => seat.connected || seat.isBot),
    });
    room.phase = 'table';
    room.game = game;
    room.scored = false;
    const instant = game.result?.instant;
    room.feed.push(
      instant
        ? `Tới trắng! ${room.seats[instant.seat]?.name ?? 'Người chơi'} — ${instant.label}`
        : 'Ván mới bắt đầu',
    );
    if (instant) io.to(room.code).emit('game:fx', { toast: 'Tới Trắng!' });
    finishIfNeeded(room, game);
    sendRoom(room);
    arm(room);
  }

  function humansReady(room: Room): boolean {
    return room.seats.filter((seat) => !seat.isBot && !seat.left).every((seat) => seat.ready);
  }

  function ensureHost(room: Room): void {
    if (room.seats.some((seat) => seat.userId === room.hostId && !seat.left && !seat.isBot)) return;
    const next = room.seats.find((seat) => !seat.isBot && !seat.left);
    if (next) room.hostId = next.userId;
  }

  function removeLobbySeat(room: Room, userId: string): void {
    const index = room.seats.findIndex((seat) => seat.userId === userId);
    if (index >= 0) room.seats.splice(index, 1);
    userRoom.delete(userId);
    if (!room.seats.some((seat) => !seat.isBot && !seat.left)) {
      destroy(room);
      return;
    }
    ensureHost(room);
    sendRoom(room);
  }

  io.use((socket, next) => {
    const user = readUser(socket.handshake.headers.cookie);
    if (!user) {
      next(new Error('Phiên đăng nhập không hợp lệ'));
      return;
    }
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as PublicUser;
    socket.join('lobby');
    const existing = roomOfUser(user.id);
    if (existing) {
      const seat = existing.seats.find((item) => item.userId === user.id && !item.left);
      if (seat) {
        if (seat.grace) clearTimeout(seat.grace);
        seat.grace = undefined;
        seat.socketId = socket.id;
        seat.connected = true;
        socket.join(existing.code);
        if (existing.game && existing.game.phase === 'playing' && existing.game.currentTurn === existing.seats.indexOf(seat)) {
          arm(existing);
        } else {
          sendRoom(existing);
        }
      }
    } else {
      socket.emit('room:state', null);
    }
    socket.emit('lobby:rooms', listRooms());

    const fail = (message: string) => socket.emit('app:error', { message });
    socket.on('lobby:subscribe', () => {
      const current = roomOfUser(user.id);
      const seat = current?.seats.find((item) => item.userId === user.id && !item.left);
      if (current && seat) {
        seat.socketId = socket.id;
        seat.connected = true;
        socket.join(current.code);
        socket.emit('room:state', snapshot(current, user.id));
      } else {
        socket.emit('room:state', null);
      }
      socket.emit('lobby:rooms', listRooms());
    });
    const seated = () => {
      const room = roomOfUser(user.id);
      if (!room) return null;
      const index = room.seats.findIndex((seat) => seat.userId === user.id && !seat.left);
      if (index < 0) return null;
      return { room, index };
    };

    socket.on('room:create', (payload?: { stake?: number; instantChop?: boolean }) => {
      if (roomOfUser(user.id)) {
        fail('Bạn đang ở trong một phòng');
        return;
      }
      if (rooms.size >= 100) {
        fail('Sảnh đang đầy. Hãy vào một phòng có sẵn.');
        return;
      }
      const stake = STAKES.includes(Number(payload?.stake)) ? Number(payload?.stake) : 20;
      const room: Room = {
        code: codeOf(),
        hostId: user.id,
        stake,
        instantChop: payload?.instantChop !== false,
        seats: [
          {
            userId: user.id,
            name: user.name,
            avatar: user.avatar,
            isBot: false,
            ready: true,
            connected: true,
            left: false,
            socketId: socket.id,
          },
        ],
        phase: 'lobby',
        game: null,
        feed: ['Phòng đã mở'],
        nextLeaderUserId: null,
        scored: false,
        token: 0,
      };
      rooms.set(room.code, room);
      userRoom.set(user.id, room.code);
      socket.join(room.code);
      sendRoom(room);
    });

    socket.on('room:join', (payload?: { code?: string }) => {
      const code = String(payload?.code ?? '')
        .trim()
        .toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        fail('Không thấy phòng này');
        return;
      }
      const already = room.seats.find((seat) => seat.userId === user.id && !seat.left);
      if (already) {
        already.socketId = socket.id;
        already.connected = true;
        socket.join(room.code);
        sendRoom(room);
        return;
      }
      if (roomOfUser(user.id)) {
        fail('Hãy rời phòng hiện tại trước');
        return;
      }
      if (room.phase !== 'lobby') {
        fail('Ván đang diễn ra');
        return;
      }
      if (room.seats.length >= 4) {
        fail('Phòng đã đủ người');
        return;
      }
      room.seats.push({
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        isBot: false,
        ready: false,
        connected: true,
        left: false,
        socketId: socket.id,
      });
      userRoom.set(user.id, room.code);
      socket.join(room.code);
      room.feed.push(`${user.name} vào phòng`);
      sendRoom(room);
    });

    socket.on('room:leave', () => {
      const found = seated();
      if (!found) {
        socket.emit('room:state', null);
        return;
      }
      const { room, index } = found;
      socket.leave(room.code);
      if (room.phase === 'lobby') {
        removeLobbySeat(room, user.id);
        socket.emit('room:state', null);
        return;
      }
      const seat = room.seats[index]!;
      seat.left = true;
      seat.connected = false;
      seat.socketId = null;
      userRoom.delete(user.id);
      room.feed.push(`${seat.name} rời bàn`);
      socket.emit('room:state', null);
      if (!room.seats.some((item) => !item.isBot && !item.left)) {
        destroy(room);
        return;
      }
      ensureHost(room);
      if (room.game && room.game.phase === 'playing') arm(room);
      else sendRoom(room);
    });

    socket.on('room:ready', () => {
      const found = seated();
      if (!found || found.room.phase !== 'lobby') return;
      const seat = found.room.seats[found.index]!;
      if (seat.isBot) return;
      seat.ready = !seat.ready;
      sendRoom(found.room);
    });

    socket.on('room:addBot', () => {
      const found = seated();
      if (!found) return;
      const { room } = found;
      if (room.hostId !== user.id || room.phase !== 'lobby') {
        fail('Chỉ chủ phòng thêm máy trong phòng chờ');
        return;
      }
      if (room.seats.length >= 4) {
        fail('Phòng đã đủ 4 ghế');
        return;
      }
      const used = new Set(room.seats.map((seat) => seat.name));
      const name = BOT_NAMES.find((item) => !used.has(item)) ?? `Máy ${room.seats.length + 1}`;
      room.seats.push({
        userId: `bot:${room.code}:${room.seats.length}:${name}`,
        name,
        avatar: null,
        isBot: true,
        ready: true,
        connected: true,
        left: false,
        socketId: null,
      });
      room.feed.push(`${name} ngồi vào bàn`);
      sendRoom(room);
    });

    socket.on('room:removeBot', (payload?: { index?: number }) => {
      const found = seated();
      if (!found) return;
      const { room } = found;
      const index = Number(payload?.index);
      const seat = room.seats[index];
      if (room.hostId !== user.id || room.phase !== 'lobby' || !seat?.isBot) return;
      room.seats.splice(index, 1);
      sendRoom(room);
    });

    socket.on('room:settings', (payload?: { stake?: number; instantChop?: boolean }) => {
      const found = seated();
      if (!found) return;
      const { room } = found;
      if (room.hostId !== user.id || room.phase !== 'lobby') return;
      if (STAKES.includes(Number(payload?.stake))) room.stake = Number(payload?.stake);
      if (typeof payload?.instantChop === 'boolean') room.instantChop = payload.instantChop;
      sendRoom(room);
    });

    socket.on('room:start', () => {
      const found = seated();
      if (!found) return;
      const { room } = found;
      if (room.hostId !== user.id) {
        fail('Chủ phòng mới bắt đầu được');
        return;
      }
      if (room.phase !== 'lobby') return;
      if (room.seats.length < 2) {
        fail('Cần ít nhất 2 người. Hãy thêm máy hoặc đợi bạn.');
        return;
      }
      const me = room.seats[found.index]!;
      me.ready = true;
      if (!humansReady(room)) {
        fail('Mọi người cần bấm Sẵn sàng');
        sendRoom(room);
        return;
      }
      startGame(room);
    });

    socket.on('game:play', (payload?: { cardIds?: string[] }) => {
      const found = seated();
      if (!found?.room.game) return;
      const ids = Array.isArray(payload?.cardIds) ? payload.cardIds.map(String).slice(0, 13) : [];
      const result = playCards(found.room.game, found.index, ids);
      if (!result.ok) {
        fail(result.error);
        return;
      }
      commit(found.room, result);
    });

    socket.on('game:pass', () => {
      const found = seated();
      if (!found?.room.game) return;
      const result = passTurn(found.room.game, found.index);
      if (!result.ok) {
        fail(result.error);
        return;
      }
      commit(found.room, result);
    });

    socket.on('game:again', () => {
      const found = seated();
      if (!found) return;
      const { room, index } = found;
      if (room.phase === 'table' && room.game?.phase === 'ended') {
        clearTimers(room);
        room.phase = 'lobby';
        room.game = null;
        for (const seat of room.seats) seat.ready = seat.isBot || seat.userId === user.id;
        room.feed.push('Chuẩn bị ván mới');
        sendRoom(room);
        return;
      }
      if (room.phase === 'lobby') {
        room.seats[index]!.ready = true;
        sendRoom(room);
      }
    });

    socket.on('disconnect', () => {
      const room = roomOfUser(user.id);
      if (!room) return;
      const seat = room.seats.find((item) => item.userId === user.id && !item.left);
      if (!seat || seat.socketId !== socket.id) return;
      seat.connected = false;
      seat.socketId = null;
      if (room.phase === 'lobby') {
        seat.grace = setTimeout(() => {
          if (seat.connected || seat.left) return;
          const live = rooms.get(room.code);
          if (!live || live.phase !== 'lobby') return;
          removeLobbySeat(live, user.id);
        }, 45_000);
        sendRoom(room);
        return;
      }
      if (room.game?.phase === 'playing' && room.game.currentTurn === room.seats.indexOf(seat)) arm(room);
      else sendRoom(room);
    });
  });
}
