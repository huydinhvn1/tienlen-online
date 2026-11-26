import { io, type Socket } from 'socket.io-client';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE || undefined, { withCredentials: true, autoConnect: true });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
