import { io, type Socket } from "socket.io-client";
import { sessionService } from "@/services/session";

const API_BASE_URL = (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_BASE_URL) || "http://10.0.2.2:3001";

const SOCKET_URL =
  (typeof process !== "undefined" && process.env.EXPO_PUBLIC_SOCKET_URL) || API_BASE_URL;

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.IO client.
 * The session token is passed via extraHeaders (Cookie) so the backend
 * can authenticate the socket using the same letsdate_session cookie.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
}
