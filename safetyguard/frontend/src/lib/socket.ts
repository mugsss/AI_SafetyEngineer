import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:8000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      auth: (cb) => {
        cb({});
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
