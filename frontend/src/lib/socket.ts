import { io, Socket } from "socket.io-client";

const API_GATEWAY_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL || "http://localhost:9000";

let socket: Socket | null = null;

/**
 * Lazily creates (once) and returns the single shared socket connection to
 * notification-service. Reconnection is handled automatically by socket.io —
 * no manual "reconnect" button anywhere in the UI. Call this from a
 * client-only useEffect as soon as a component mounts; it is idempotent.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  console.log(API_GATEWAY_URL);
  
  socket = io(API_GATEWAY_URL, {
    path: "/socket.io",
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    transports: ["websocket", "polling"],
  });

  return socket;
}

/** Fully tears down the socket — call on logout so a fresh login gets a clean connection. */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
